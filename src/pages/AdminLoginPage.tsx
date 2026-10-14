import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn, checkIsAdmin, signOut } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Loader2, Lock, Mail, Eye, EyeOff, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/tracker", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  const onSubmit = async (data: LoginFormData) => {
    setError("");
    setSubmitting(true);
    try {
      const firebaseUser = await signIn(data.email, data.password);
      const adminStatus = await checkIsAdmin(firebaseUser);
      if (!adminStatus) {
        await signOut();
        setError("Access denied. This account does not possess administrator credentials.");
        setSubmitting(false);
        return;
      }
      navigate("/tracker", { replace: true });
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (
        firebaseError.code === "auth/user-not-found" ||
        firebaseError.code === "auth/wrong-password" ||
        firebaseError.code === "auth/invalid-credential"
      ) {
        setError("Invalid email address or password. Please verify and try again.");
      } else if (firebaseError.code === "auth/too-many-requests") {
        setError("Too many consecutive attempts. Please pause and try again in a few moments.");
      } else {
        setError("Authentication service unavailable. Please check network connection.");
      }
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7FD]">
        <Loader2 className="h-10 w-10 animate-spin text-[#7C3AED]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#F8F7FD] p-4 overflow-hidden font-sans">
      {/* Background ambient lilac and indigo lights */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#E9D4FF]/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#C084FC] shadow-xl shadow-purple-500/20 p-1 mb-2">
            <div className="h-full w-full bg-white/10 backdrop-blur-xs rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Admin Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Mentee Daily Status & Performance Tracking
          </p>
        </div>

        {/* Card */}
        <Card className="border border-purple-100 bg-white/95 backdrop-blur-xl shadow-xl shadow-purple-500/5 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-4 pt-6">
            <CardTitle className="text-lg font-bold text-slate-900">
              Administrator Sign In
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Enter your authorized admin credentials to proceed
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs flex items-start gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                  <span className="flex-1">{error}</span>
                </div>
              )}


              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@organization.com"
                    className="pl-9 h-10 rounded-xl bg-slate-50/60 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#7C3AED] focus:ring-[#7C3AED]/20 text-xs"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-rose-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    className="pl-9 pr-10 h-10 rounded-xl bg-slate-50/60 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#7C3AED] focus:ring-[#7C3AED]/20 text-xs"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-500">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-10 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#6D28D9] hover:to-[#7C3AED] text-white font-semibold rounded-xl text-xs shadow-md shadow-purple-500/25 border-0 transition-all cursor-pointer"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying Credentials...
                  </>
                ) : (
                  "Access Admin Workspace"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security badges */}
        <div className="flex items-center justify-center gap-6 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Admin Role Verified
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" />
            Encrypted Workspace
          </span>
        </div>
      </div>
    </div>
  );
}
