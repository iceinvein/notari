import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Notari
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Tamper-evident proof-of-work verification system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-4">
            <CardHeader>
              <h2 className="text-xl font-semibold">Project Setup Complete</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Tauri + React + TypeScript</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Biome (Linting & Formatting)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Vitest (Testing Framework)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Tailwind CSS + HeroUI</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Core TypeScript Interfaces</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="p-4">
            <CardHeader>
              <h2 className="text-xl font-semibold">Test Tauri Integration</h2>
            </CardHeader>
            <CardBody>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  greet();
                }}
              >
                <Input
                  label="Enter your name"
                  placeholder="Type your name here..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Button
                  type="submit"
                  color="primary"
                  className="w-full"
                  disabled={!name.trim()}
                >
                  Greet from Rust Backend
                </Button>
                {greetMsg && (
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                    <p className="text-green-800 dark:text-green-200">
                      {greetMsg}
                    </p>
                  </div>
                )}
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ready to start implementing the Notari proof system features
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
