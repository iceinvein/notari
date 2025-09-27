import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import type React from "react";

interface LoginModeProps {
  onLogin: () => void;
  onSignUp: () => void;
}

const LoginMode: React.FC<LoginModeProps> = ({ onLogin, onSignUp }) => {
  return (
    <Card className="w-full h-full bg-transparent shadow-none border-none rounded-xl">
      <CardHeader className="pb-3 px-4 pt-6">
        <div className="flex flex-col w-full text-center">
          <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
          <p className="text-sm text-gray-400 mt-1">Sign in to your Notari account</p>
        </div>
      </CardHeader>
      <Divider className="bg-gray-700/50" />
      <CardBody className="pt-6 px-4 pb-4">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-4">
              <Input
                type="email"
                label="Email"
                placeholder="Enter your email"
                variant="bordered"
                classNames={{
                  base: "w-full",
                  input: "text-white",
                  inputWrapper:
                    "bg-gray-800/50 border-gray-600 hover:border-gray-500 focus-within:!border-blue-500",
                  label: "text-gray-300",
                }}
              />
              <Input
                type="password"
                label="Password"
                placeholder="Enter your password"
                variant="bordered"
                classNames={{
                  base: "w-full",
                  input: "text-white",
                  inputWrapper:
                    "bg-gray-800/50 border-gray-600 hover:border-gray-500 focus-within:!border-blue-500",
                  label: "text-gray-300",
                }}
              />
            </div>

            <div className="space-y-3">
              <Button
                color="primary"
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                onPress={onLogin}
              >
                Sign In
              </Button>

              <div className="text-center">
                <span className="text-sm text-gray-400">Don't have an account? </span>
                <button
                  type="button"
                  onClick={onSignUp}
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  Sign up
                </button>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default LoginMode;
