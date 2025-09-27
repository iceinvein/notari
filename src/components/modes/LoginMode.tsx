import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import type React from "react";
import ThemeToggle from "../ThemeToggle";

interface LoginModeProps {
  onLogin: () => void;
  onSignUp: () => void;
}

const LoginMode: React.FC<LoginModeProps> = ({ onLogin, onSignUp }) => {
  return (
    <Card className="w-full h-full bg-transparent shadow-none border-none rounded-xl">
      <CardHeader className="pb-3 px-4 pt-6">
        <div className="flex flex-col w-full">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 text-center">
              <h2 className="text-2xl font-bold text-foreground">Welcome Back</h2>
              <p className="text-sm text-foreground-500 mt-1">Sign in to your Notari account</p>
            </div>
            <div className="ml-4">
              <ThemeToggle variant="compact" size="sm" />
            </div>
          </div>
        </div>
      </CardHeader>
      <Divider />
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
                  input: "text-foreground",
                  inputWrapper:
                    "bg-default-100 border-default-300 hover:border-default-400 focus-within:!border-primary",
                  label: "text-foreground-600",
                }}
              />
              <Input
                type="password"
                label="Password"
                placeholder="Enter your password"
                variant="bordered"
                classNames={{
                  base: "w-full",
                  input: "text-foreground",
                  inputWrapper:
                    "bg-default-100 border-default-300 hover:border-default-400 focus-within:!border-primary",
                  label: "text-foreground-600",
                }}
              />
            </div>

            <div className="space-y-3">
              <Button
                color="primary"
                size="lg"
                className="w-full font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                onPress={onLogin}
              >
                Sign In
              </Button>

              <div className="text-center">
                <span className="text-sm text-foreground-500">Don't have an account? </span>
                <button
                  type="button"
                  onClick={onSignUp}
                  className="text-sm text-primary hover:text-primary-600 underline transition-colors"
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
