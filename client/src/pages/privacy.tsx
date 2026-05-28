import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function PrivacyPage() {
  usePageMeta({
    title: "プライバシーポリシー | Arche — Sourirette合同会社",
    description: "Arche（Sourirette合同会社）における個人情報の収集・利用・管理・開示に関するプライバシーポリシーです。",
  });
  return (
    <div className="min-h-screen bg-[#F5F1ED]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-[13px] text-[#1a1a2e]/50 hover:text-[#1a1a2e] transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" />
          トップページに戻る
        </Link>

        <h1 className="text-3xl font-bold text-[#1a1a2e] mb-2">プライバシーポリシー</h1>
        <p className="text-[13px] text-[#1a1a2e]/40 mb-12">最終更新日：2026年4月4日</p>

        <div className="space-y-10 text-[15px] text-[#1a1a2e]/70 leading-relaxed">
          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">1. 総則</h2>
            <p>
              Sourirette合同会社（以下「当社」）は、Arche（以下「本サービス」）の提供にあたり、
              ご利用者（歯科医院・クリニックの管理者・スタッフ、および患者様）の個人情報を適切に取り扱うことを
              重要な責務と考えています。本プライバシーポリシーは、当社が収集・利用・保管・開示する
              個人情報の取り扱いについて定めるものです。個人情報保護法および厚生労働省・経済産業省・総務省が定める
              「医療情報を取り扱う情報システム・サービスの提供事業者における安全管理ガイドライン」に準拠して運用します。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">2. 収集する情報</h2>
            <p className="mb-3">当社は以下の情報を収集することがあります：</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>氏名、メールアドレス、電話番号などの連絡先情報</li>
              <li>歯科医院・クリニックの名称・住所・代表者情報</li>
              <li>予約情報（日時、施術内容、担当スタッフ）</li>
              <li>患者様の診療記録（本サービスを通じて医院が入力した情報）</li>
              <li>サービス利用に関するログ情報・アクセス情報</li>
              <li>お支払い情報（決済代行業者を通じて処理します。当社はカード番号を保持しません）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">3. 情報の利用目的</h2>
            <p className="mb-3">収集した情報は、以下の目的で利用します：</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>本サービスの提供・運営・改善</li>
              <li>予約確認・リマインダーメールの送信</li>
              <li>カスタマーサポートの提供</li>
              <li>サービスに関するお知らせの配信</li>
              <li>不正利用の検知・防止</li>
              <li>法令上の義務の履行</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">4. 患者データへのシステム管理者アクセスについて</h2>
            <p className="mb-3">
              本サービスは、歯科医院がシステムに入力した患者の予約情報・診療記録等（以下「患者データ」）を
              クラウド上で管理します。患者データの権利および管理責任は各医院に帰属しますが、
              当社のシステム管理者は以下の目的においてのみ患者データにアクセスする場合があります：
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li>システムの障害対応・保守・デバッグ</li>
              <li>カスタマーサポート時の問い合わせ対応</li>
              <li>セキュリティインシデントの調査・対応</li>
              <li>法令に基づく開示が必要な場合</li>
            </ul>
            <p>
              上記以外の目的（マーケティング・分析・販売等）でアクセスすることは一切ありません。
              当社のシステム管理者は守秘義務を負っており、業務外での患者データの閲覧・利用・漏洩は禁止されています。
              本事項は、個人情報保護法上の「委託に伴う個人データの取り扱い」として整理されます。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">5. 情報の第三者提供</h2>
            <p>
              当社は、以下の場合を除き、ご利用者の個人情報を第三者に提供しません：
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>ご本人の同意がある場合</li>
              <li>法令に基づく場合</li>
              <li>サービス提供に必要な業務委託先（決済代行会社、メール配信会社等）への提供</li>
              <li>合併・事業譲渡等に伴う事業承継の場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">6. データの保管・セキュリティ</h2>
            <p>
              当社は、個人情報への不正アクセス・紛失・破壊・改ざん・漏洩を防止するために、
              適切な技術的・組織的安全措置を講じています。データは暗号化された安全なサーバーに保管されます。
              万一、個人データに関わるセキュリティ事故が発生した場合は、個人情報保護法に基づき速やかに
              ご利用者および当局への報告を行います。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">7. Cookie・解析ツール</h2>
            <p>
              本サービスでは、セッション管理およびサービス品質向上のためにCookieを使用することがあります。
              ブラウザの設定でCookieを無効化することができますが、一部機能が正常に動作しない場合があります。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">8. お子様のプライバシー</h2>
            <p>
              本サービスは16歳未満の方を対象としていません。16歳未満の方の個人情報を意図的に収集することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">9. 個人情報の開示・訂正・削除</h2>
            <p>
              ご自身の個人情報の開示・訂正・削除をご希望の場合は、下記お問い合わせ先までご連絡ください。
              法令の定めに従い、合理的な期間内に対応いたします。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">10. ポリシーの変更</h2>
            <p>
              当社は、法令の改正やサービス内容の変更に伴い、本プライバシーポリシーを改定することがあります。
              重要な変更がある場合は、本サービス上でお知らせします。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">11. お問い合わせ</h2>
            <p>
              本プライバシーポリシーに関するお問い合わせは、以下の窓口までご連絡ください。
            </p>
            <div className="mt-3 p-4 bg-white/60 rounded-xl border border-[#1a1a2e]/[0.06]">
              <p className="font-medium text-[#1a1a2e]">Sourirette合同会社</p>
              <p>個人情報保護担当</p>
              <p>Email: <a href="mailto:sourirette.consulting@gmail.com" className="text-[#1a1a2e] underline underline-offset-2">sourirette.consulting@gmail.com</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
