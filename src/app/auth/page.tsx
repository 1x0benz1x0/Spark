"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sparkAuth, setMe } from "@/lib/spark-auth";
import { LogOut, Eye, EyeOff } from "lucide-react";
import { SparkLogo } from "../components/SparkLogo";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function submit() {
    if (!username.trim() || !password) return;
    const res = await sparkAuth(mode, username.trim(), password);
    if (!res.ok) setMsg(res.error ?? "something went wrong");
    else { setMe(res.user!); router.push("/"); }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* logo above card */}
          <div className="flex justify-center mb-6">
            <SparkLogo className="w-16 h-16" />
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <h1 className="text-3xl font-bold mb-6 text-center" style={{ fontFamily: "cursive" }}>Spark</h1>

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors ${mode === "login" ? "bg-white text-black" : "bg-[#26292D] text-zinc-400 hover:bg-[#363A3F]"}`}
              >
                Log in
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors ${mode === "signup" ? "bg-white text-black" : "bg-[#26292D] text-zinc-400 hover:bg-[#363A3F]"}`}
              >
                Sign up
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-full text-sm outline-none focus:border-zinc-500 transition"
              />
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-full text-sm outline-none focus:border-zinc-500 transition pr-12"
                />
                <button onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1" aria-label="Show password">
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <button
                onClick={submit}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-full text-sm font-semibold text-white transition-colors mt-1"
              >
                {mode === "login" ? "Log in" : "Sign up"}
              </button>
            </div>

            {msg && <p className="text-sm text-zinc-400 mt-4 text-center">{msg}</p>}
          </div>

          <p className="text-center text-xs text-zinc-600 mt-6">
            Spark for MCHS — share, chat, and watch Sparks.
          </p>
        </div>
      </div>
    </div>
  );
}
