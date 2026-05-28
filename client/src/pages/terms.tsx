import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function TermsPage() {
  usePageMeta({
    title: "利用規約 | Arche — Sourirette合同会社",
    description: "Arche（Sourirette合同会社）の利用規約です。サービスのご利用にあたっての条件・禁止事項・免責事項を定めています。",
  });
  return (
    <div className="min-h-screen bg-[#F5F1ED]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-[13px] text-[#1a1a2e]/50 hover:text-[#1a1a2e] transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" />
          トップページに戻る
        </Link>

        <h1 className="text-3xl font-bold text-[#1a1a2e] mb-2">利用規約</h1>
        <p className="text-[13px] text-[#1a1a2e]/40 mb-12">最終更新日：2026年4月4日</p>

        <div className="space-y-10 text-[15px] text-[#1a1a2e]/70 leading-relaxed">
          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第1条（適用）</h2>
            <p>
              本利用規約（以下「本規約」）は、Sourirette合同会社（以下「当社」）が提供するArche
              （以下「本サービス」）の利用条件を定めるものです。ご利用者（歯科医院・クリニックの管理者・スタッフ）は、
              本規約に同意のうえ本サービスをご利用ください。本規約は、民法第548条の2に定める定型約款として機能します。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第2条（アカウント登録）</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>本サービスを利用するには、アカウント登録が必要です。</li>
              <li>登録情報は正確・最新の情報を入力してください。</li>
              <li>アカウントの管理・セキュリティはご利用者の責任において行ってください。</li>
              <li>第三者へのアカウントの貸与・譲渡は禁止します。</li>
              <li>パスワードが漏洩した疑いがある場合は、直ちに変更し当社にご連絡ください。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第3条（料金・支払い）</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>本サービスの料金は当社が定める料金表に従います。</li>
              <li>無料プランの範囲を超える機能には有料プランへの加入が必要です。</li>
              <li>月額料金は毎月自動更新されます。</li>
              <li>解約は次回更新日の前日までに行う必要があります。解約後も当該月末まではサービスをご利用いただけます。</li>
              <li>料金は原則として返金いたしません。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第4条（禁止事項）</h2>
            <p className="mb-3">ご利用者は、以下の行為を行ってはなりません：</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>法令または公序良俗に反する行為</li>
              <li>当社または第三者の著作権・商標権・その他の知的財産権を侵害する行為</li>
              <li>当社または第三者の個人情報を不正に収集・利用・開示する行為</li>
              <li>本サービスの運営を妨害する行為（不正アクセス・過度な負荷をかける行為等）</li>
              <li>虚偽の情報を登録する行為</li>
              <li>本サービスのリバースエンジニアリング・逆コンパイル・逆アセンブル</li>
              <li>その他、当社が不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第5条（知的財産権）</h2>
            <p>
              本サービスに関するすべての著作権・商標権・その他の知的財産権は当社または正当な権利者に帰属します。
              本規約に基づく利用許諾は、これらの権利の譲渡を意味するものではありません。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第6条（患者データの取り扱いと個人情報の委託）</h2>
            <p className="mb-4">
              ご利用者が本サービスに入力した患者情報（氏名・連絡先・予約情報・診療記録等。以下「患者データ」）の権利および管理責任は、当該医院（ご利用者）に帰属します。当社は、個人情報保護法に基づく個人データの取り扱いの委託先として、以下のとおり患者データを取り扱います。
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li>当社は、本サービスの提供・運用・保守・障害対応・カスタマーサポートの目的においてのみ、患者データにアクセスします。</li>
              <li>当社は、上記の業務目的以外での患者データの閲覧・利用・解析・第三者への提供を行いません。</li>
              <li>当社は、患者データを当社自身のマーケティング・分析・販売等の目的に使用しません。</li>
              <li>当社は、患者データの取り扱いについて、従業員に対して必要な守秘義務を課します。</li>
              <li>本サービス解約後30日以内に、当社のサーバーから患者データを削除します。</li>
            </ul>
            <p className="mb-4">
              ご利用者は、本規約への同意をもって、上記目的の範囲内での患者データの取り扱いを当社に委託することに同意したものとみなします。本同意は、個人情報保護法上の「委託に伴う個人データの提供」として取り扱われます。
            </p>
            <p>
              ご利用者は、患者様から本サービスを利用した予約管理・診療情報の管理に関する適切な同意を取得する責任を負います。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第7条（セキュリティ）</h2>
            <p className="mb-3">
              当社は、患者データへの不正アクセス・漏洩・滅失・毀損を防止するため、以下の安全管理措置を講じます：
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>通信の暗号化（HTTPS/TLS）</li>
              <li>データベースへのアクセス制御</li>
              <li>定期的な脆弱性対応</li>
              <li>システム管理者によるアクセスログの管理</li>
            </ul>
            <p className="mt-3">
              万一、患者データに関するセキュリティ事故が発生した場合、当社は速やかにご利用者に通知するとともに、
              個人情報保護法に基づく対応を行います。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第8条（免責事項）</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>当社は、本サービスの完全性・正確性・有用性を保証しません。</li>
              <li>システム障害・メンテナンス等によりサービスが一時的に利用できない場合があります。</li>
              <li>当社は、本サービスの利用によって生じた損害について、当社の故意または重大な過失による場合を除き、責任を負いません。</li>
              <li>当社が損害賠償責任を負う場合でも、賠償額は当該月の利用料金を上限とします。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第9条（サービスの変更・終了）</h2>
            <p>
              当社は、ご利用者に事前に通知することで、本サービスの内容を変更または終了することができます。
              重要な変更については、30日前を目安にご通知します。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第10条（規約の変更）</h2>
            <p>
              当社は必要に応じて本規約を変更することができます。変更後の規約は本サービス上に掲示した時点から効力を生じます。
              変更後も本サービスをご利用いただいた場合は、変更後の規約に同意したものとみなします。
              ご利用者に不利益となる重要な変更については、30日以上前にメールまたはサービス内通知にてお知らせします。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第11条（準拠法・管轄裁判所）</h2>
            <p>
              本規約は日本法に準拠します。本規約に関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold text-[#1a1a2e] mb-3">第12条（お問い合わせ）</h2>
            <div className="p-4 bg-white/60 rounded-xl border border-[#1a1a2e]/[0.06]">
              <p className="font-medium text-[#1a1a2e]">Sourirette合同会社</p>
              <p>Email: <a href="mailto:sourirette.consulting@gmail.com" className="text-[#1a1a2e] underline underline-offset-2">sourirette.consulting@gmail.com</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
