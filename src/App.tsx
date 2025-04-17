import { Authenticated, Unauthenticated } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "./components/ui/toaster";
import { SketchCanvas } from "./components/SketchCanvas";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col" style={{
        backgroundImage: "url('/img/image.png')",
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}>

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <Content />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  return (
    <div className="flex flex-col gap-8" >
      <div className="text-center">
        <Authenticated>
          <SketchCanvas />
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-slate-600">Sign in to start sketching</p>
          <SignInForm />
        </Unauthenticated>
      </div>
    </div>
  );
}
