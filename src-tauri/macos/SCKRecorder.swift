import Foundation
import ScreenCaptureKit
import AVFoundation
import AppKit

import CoreMedia

// Simple command-line tool: parses args, starts capture, waits for stdin EOF, then stops.

final class Recorder: NSObject, SCStreamOutput {
    private var stream: SCStream!
    private var writer: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private var pixelAdaptor: AVAssetWriterInputPixelBufferAdaptor?
    private var basePTS: CMTime?
    private var lastPixelBuffer: CVPixelBuffer?
    private var lastRelPTS: CMTime = .zero
    private let frameTimescale: Int32 = 30
    private lazy var frameDuration = CMTime(value: 1, timescale: frameTimescale)
    private var tickTimer: DispatchSourceTimer?
    private var outputURL: URL
    private let outputQueue = DispatchQueue(label: "sck.recorder.output")

    init(windowId: UInt32, outputURL: URL) throws {
        guard #available(macOS 12.3, *) else {
            throw NSError(domain: "sck", code: 1, userInfo: [NSLocalizedDescriptionKey: "Requires macOS 12.3+"])
        }

        fputs("[sck] init windowId=\(windowId) output=\(outputURL.path)\n", stderr)
        var fetched: SCShareableContent?
        var fetchErr: NSError?
        let sem = DispatchSemaphore(value: 0)
        SCShareableContent.getWithCompletionHandler { content, error in
            fetched = content
            fetchErr = error as NSError?
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 5)
        if let e = fetchErr { fputs("[sck] get content error: \(e.localizedDescription)\n", stderr); throw e }
        guard let content = fetched else { throw NSError(domain: "sck", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to get content"]) }
        guard let target = content.windows.first(where: { $0.windowID == windowId }) else {
            fputs("[sck] window not found in shareable content: id=\(windowId)\n", stderr)
            throw NSError(domain: "sck", code: 3, userInfo: [NSLocalizedDescriptionKey: "Window not found in shareable content"])
        }

        let filter = SCContentFilter(desktopIndependentWindow: target)
        let cfg = SCStreamConfiguration()
        let size = target.frame.size
        cfg.width = max(2, Int(size.width))
        cfg.height = max(2, Int(size.height))
        cfg.scalesToFit = true
        cfg.showsCursor = false
        if #available(macOS 13.0, *) {
            cfg.pixelFormat = kCVPixelFormatType_32BGRA
            cfg.minimumFrameInterval = CMTime(value: 1, timescale: 30) // ~30 fps
        }
        fputs("[sck] config width=\(cfg.width) height=\(cfg.height)\n", stderr)

        // Defer writer creation until first frame so we can bind exact pixel size
        self.outputURL = outputURL

        super.init()

        self.stream = SCStream(filter: filter, configuration: cfg, delegate: nil)
        var addErr: NSError?
        do {
            try self.stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: outputQueue)
        } catch {
            addErr = error as NSError
        }
        if let e = addErr { fputs("[sck] addStreamOutput error: \(e.localizedDescription)\n", stderr); throw e }
        fputs("[sck] stream configured and output added\n", stderr)
    }

    func start() throws {
        fputs("[sck] startCapture...\n", stderr)
        let sem = DispatchSemaphore(value: 0)
        stream.startCapture { error in
            if let e = error {
                fputs("[sck] startCapture error: \(e.localizedDescription)\n", stderr)
            } else {
                fputs("[sck] startCapture ok\n", stderr)
            }
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 5)
    }

    func stop() {
        fputs("[sck] stopCapture...\n", stderr)
        let sem = DispatchSemaphore(value: 0)
        stream.stopCapture { _ in
            if let vi = self.videoInput { vi.markAsFinished() }
            if let w = self.writer {
                w.finishWriting {
                    fputs("[sck] finishWriting\n", stderr)
                    sem.signal()
                }
            } else {
                sem.signal()
            }
        }
        _ = sem.wait(timeout: .now() + 5)
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, CMSampleBufferIsValid(sampleBuffer) else { return }

        let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        if basePTS == nil { basePTS = pts }
        guard let base = basePTS else { return }
        let rel = CMTimeSubtract(pts, base)

        var pb = CMSampleBufferGetImageBuffer(sampleBuffer)
        if pb == nil, let last = lastPixelBuffer {
            pb = last // duplicate previous frame to keep timeline advancing
        }

        guard let pixelBuffer = pb else {
            fputs("[sck] sample buffer missing image buffer (no last)", stderr)
            fputs("\n", stderr)
            return
        }
        lastPixelBuffer = pixelBuffer

        // Lazy-create writer on first real/deduped frame and bind exact dimensions
        if writer == nil {
            let w = CVPixelBufferGetWidth(pixelBuffer)
            let h = CVPixelBufferGetHeight(pixelBuffer)
            do {
                let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mov)
                let settings: [String: Any] = [
                    AVVideoCodecKey: AVVideoCodecType.h264,
                    AVVideoWidthKey: w,
                    AVVideoHeightKey: h,
                    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 6_000_000]
                ]
                let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
                input.expectsMediaDataInRealTime = true
                guard writer.canAdd(input) else {
                    fputs("[sck] cannot add video input\n", stderr)
                    return
                }
                writer.add(input)
                let adaptor = AVAssetWriterInputPixelBufferAdaptor(
                    assetWriterInput: input,
                    sourcePixelBufferAttributes: [
                        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                        kCVPixelBufferWidthKey as String: w,
                        kCVPixelBufferHeightKey as String: h,
                        kCVPixelBufferIOSurfacePropertiesKey as String: [:]
                    ]
                )
                self.writer = writer
                self.videoInput = input
                self.pixelAdaptor = adaptor
                if !writer.startWriting() {
                    fputs("[sck] writer.startWriting failed\n", stderr)
                    return
                }
                writer.startSession(atSourceTime: .zero)
                fputs("[sck] first frame dims=\(w)x\(h) rel=\(rel.seconds)\n", stderr)
            } catch {
                fputs("[sck] writer create error: \(error.localizedDescription)\n", stderr)
                return
            }
        }

        guard let writer = self.writer, let input = self.videoInput, let adaptor = self.pixelAdaptor else { return }
        if writer.status == .failed {
            if let err = writer.error as NSError? { fputs("[sck] writer failed: \(err.domain)#\(err.code) \(err.localizedDescription)\n", stderr) }
            return
        }
        guard input.isReadyForMoreMediaData, writer.status == .writing else { return }

        if !adaptor.append(pixelBuffer, withPresentationTime: rel) {
            fputs("[sck] pixelAdaptor.append returned false\n", stderr)
            if let err = writer.error as NSError? { fputs("[sck] writer error after append: \(err.domain)#\(err.code) \(err.localizedDescription)\n", stderr) }
        }
    }
}

// Entry point
if CommandLine.arguments.count < 3 {
    fputs("[sck] usage: sck-recorder <windowId> <outputPath>\n", stderr)
    exit(2)
}
let winStr = CommandLine.arguments[1]
let outputPath = CommandLine.arguments[2]
fputs("[sck] args windowId=\(winStr) output=\(outputPath)\n", stderr)

// Ensure CoreGraphics/AppKit are initialized for CGS (avoids CGS_REQUIRE_INIT aborts)
let _ = NSApplication.shared
fputs("[sck] appkit initialized\n", stderr)

guard let windowId = UInt32(winStr) else {
    fputs("[sck] invalid window id: \(winStr)\n", stderr)
    exit(2)
}
let url = URL(fileURLWithPath: outputPath)

do {
    let recorder = try Recorder(windowId: windowId, outputURL: url)
    try recorder.start()
    // Block until stdin closes (EOF)
    _ = try? FileHandle.standardInput.readToEnd()
    recorder.stop()
    exit(0)
} catch {
    fputs("[sck] error: \(error.localizedDescription)\n", stderr)
    exit(1)
}

