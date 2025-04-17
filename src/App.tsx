import { Authenticated, Unauthenticated } from "convex/react";
import { useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Toaster } from "./components/ui/toaster";
import { SketchCanvas } from "./components/SketchCanvas";

export default function App() {
  const { signIn } = useAuthActions();

  // Automatically sign in anonymously when app loads
  useEffect(() => {
    const autoSignIn = async () => {
      try {
        await signIn("anonymous");
      } catch (error) {
        console.error("Auto sign-in failed:", error);
      }
    };
    autoSignIn();
  }, [signIn]);

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
          <p className="text-xl text-slate-600">Loading sketch canvas...</p>
        </Unauthenticated>
      </div>
    </div>
  );
}
