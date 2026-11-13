// サインインの1段目：メールアドレスとパスワード
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { CircleAlert, Eye, EyeOff, KeyRound } from "lucide-react";
import { ArcheMark } from "@/apps/launcher/ArcheMark";
import { Button, Switch, cn, springSoft, useToast } from "@/ui";

export const DEMO_EMAIL = "reception@hidamari-dental.jp";

export function Credentials({ onDone, phone, footer }: { onDone: (via: "password" | "passkey") => void; phone: boolean; footer?: React.ReactNode }) {
  const toast = useToast();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);
  const [error, setError] = useState<string | false>(false);
  const [busy, setBusy] = useState<"password" | "passkey" | null>(null);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  const shake = useAnimationControls();
  const pwRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = () => {
    if (busy) return;
    // 何が足りないのかを、そのまま伝える（未入力を「違います」と言わない）
    const mail = email.trim();
    const problem = !mail
      ? "メールアドレスを入力してください"
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)
        ? "メールアドレスの形式をご確認ください"
        : !pw
          ? "パスワードを入力してください"
          : pw.length < 4
            ? "パスワードは4文字以上です。もう一度ご確認ください"
            : null;
    if (problem) {
      setError(problem);
      shake.start({ x: [0, -9, 9, -6, 6, -2, 0], transition: { duration: 0.42 } });
      if (problem.startsWith("メール")) emailRef.current?.focus();
      else pwRef.current?.focus();
      return;
    }
    setBusy("password");
    timer.current = setTimeout(() => onDone("password"), 620);
  };
  const passkey = () => {
    if (busy) return;
    setError(false);
    setBusy("passkey");
    timer.current = setTimeout(() => onDone("passkey"), 900);
  };

  const primary = (
    <Button size="lg" full onClick={submit} disabled={busy === "passkey"} className="relative overflow-hidden">
      {busy === "password" && (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-onink/14"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
      )}
      <span className="relative">{busy === "password" ? "確認しています…" : "サインイン"}</span>
    </Button>
  );
  const secondary = (
    <Button size="lg" variant="gray" full icon={KeyRound} onClick={passkey} disabled={busy === "password"} className="relative overflow-hidden">
      {busy === "passkey" && (
        <motion.span aria-hidden className="absolute inset-y-0 left-0 bg-fill/16" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 0.88, ease: [0.4, 0, 0.2, 1] }} />
      )}
      <span className="relative">{busy === "passkey" ? "パスキーを確認しています…" : "パスキーでサインイン"}</span>
    </Button>
  );

  return (
    <div className="flex flex-1 flex-col">
      <ArcheMark size={phone ? 56 : 52} />
      <h1 className="mt-6 text-[28px] font-bold leading-[1.25] tracking-[-0.01em] palt">Arche にサインイン</h1>
      <p className="mt-2 text-[15px] leading-[1.7] text-label2">医院から発行されたアカウントを使います。</p>

      <form
        className="mt-8"
        onSubmit={e => { e.preventDefault(); submit(); }}
        noValidate
      >
        <motion.div animate={shake}>
          <div className={cn("overflow-hidden rounded-cell bg-surface transition-shadow duration-200", phone ? "" : "hairline", error && "shadow-[inset_0_0_0_1px_rgb(var(--red)/0.55)]")}>
            <Field label="メールアドレス">
              <input
                ref={emailRef}
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(false); }}
                className="w-full bg-transparent text-[16px] outline-none placeholder:text-label3"
                placeholder="name@clinic.jp"
              />
            </Field>
            <div className="ml-4 h-px scale-y-50 bg-sep/30" />
            <Field
              label="パスワード"
              trailing={
                <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  aria-label={show ? "パスワードを隠す" : "パスワードを表示"}
                  className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-label2 transition-colors hover:bg-fill/10"
                >
                  {show ? <EyeOff className="h-[19px] w-[19px]" strokeWidth={2} /> : <Eye className="h-[19px] w-[19px]" strokeWidth={2} />}
                </button>
              }
            >
              <input
                ref={pwRef}
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={pw}
                onChange={e => { setPw(e.target.value); setError(false); }}
                className="w-full bg-transparent text-[16px] outline-none placeholder:text-label3"
                placeholder="必須"
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
              />
            </Field>
          </div>
        </motion.div>
        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              id="login-error"
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={springSoft}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-1.5 px-1 pt-2.5 text-[13px] leading-[1.6] text-red">
                <CircleAlert className="mt-[2px] h-[15px] w-[15px] shrink-0" strokeWidth={2.2} />
                <span>{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn("mt-3 flex min-h-[48px] items-center justify-between gap-3 rounded-cell px-4", phone ? "bg-surface" : "bg-surface2")}>
          <span className="text-[15px]">サインインしたままにする</span>
          <Switch checked={keep} onChange={setKeep} label="サインインしたままにする" />
        </div>
        <p className="mt-2 px-1 text-[12px] leading-[1.6] text-label3">{keep ? "この端末で30日間、サインインしたままになります。" : "ブラウザを閉じると、サインアウトします。"}</p>

        {/* PC：フォームの中にボタン。スマホ：下に固定 */}
        {!phone && <div className="mt-6 flex flex-col gap-2.5">{primary}{secondary}</div>}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>

      <div className={cn(phone ? "mt-6" : "mt-5", "text-center")}>
        <button type="button" onClick={() => setForgot(v => !v)} aria-expanded={forgot} className="h-11 px-2 text-[14px] font-medium text-accent">
          パスワードをお忘れの場合
        </button>
      </div>
      <AnimatePresence initial={false}>
        {forgot && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={springSoft} className="overflow-hidden">
            <div className="mt-1 rounded-cell bg-fill/8 p-4 text-[13px] leading-[1.7] text-label2">
              {sent ? (
                <>
                  <span className="font-semibold text-label">{email || DEMO_EMAIL}</span> に再設定のメールを送りました。メールのリンクから、24時間以内に新しいパスワードを設定してください。届かないときは、医院の管理者にお問い合わせください。
                </>
              ) : (
                <>
                  入力したメールアドレスに、パスワードを再設定するためのリンクを送ります。リンクの有効期限は24時間です。
                  <div className="mt-3">
                    <Button size="sm" variant="tinted" onClick={() => { setSent(true); toast("再設定のメールを送りました", { detail: email || DEMO_EMAIL }); }}>
                      再設定のメールを送る
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phone && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-auto bg-bg/92 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-6 backdrop-blur">
          <div className="flex flex-col gap-2.5">{primary}{secondary}</div>
          {footer && <div className="mt-3 text-center">{footer}</div>}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, trailing }: { label: string; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="flex min-h-[60px] items-center gap-2 px-4">
      <label className="flex min-w-0 flex-1 flex-col justify-center py-2">
        <span className="text-[12px] font-medium leading-[16px] text-label2">{label}</span>
        <span className="mt-0.5 flex h-[22px] items-center">{children}</span>
      </label>
      {trailing}
    </div>
  );
}
