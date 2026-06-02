import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">404 ページが見つかりません</h1>

          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            お探しのページは存在しないか、移動した可能性があります。
          </p>

          <div className="mt-6">
            <Button asChild variant="outline" className="w-full h-12 text-base active:scale-95 transition-transform">
              <Link href="/">トップページに戻る</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
