import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * アプリ全体を包むエラーバウンダリ。
 * これまでは描画中に例外が出ると画面が真っ白になっていたが、
 * ここで捕捉してフォールバックUIを表示し、再読み込みできるようにする。
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 本番でも原因を追えるようにコンソールへ出す
    console.error("UI error boundary caught:", error, info);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">問題が発生しました</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              画面の表示中にエラーが発生しました。お手数ですが、再読み込みをお試しください。
            </p>
            {this.state.error?.message && (
              <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-left text-xs text-muted-foreground break-words">
                {this.state.error.message}
              </p>
            )}
            <Button className="mt-5 h-12 w-full text-base" onClick={this.handleReload} data-testid="button-error-reload">
              再読み込みする
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
