// 電子同意書のPDF生成。jsPDF をサーバーサイドで使用。
// 日本語フォントの埋め込みは重いため、PDFは見出し等を英語ラベル＋
// 患者名/治療内容/金額の値を描画。日本語の値はNoto Sans JP相当が無いと
// 文字化けするため、ここでは「画面の見た目をそのままPDF化」する方針として、
// クライアントから受け取った同意書HTMLの画像(dataURL)を貼り付ける方式を採用する。
//
// signatureDataUrl: 署名のPNG dataURL
// snapshotDataUrl: 同意書全体の見た目を画像化した dataURL（任意・あれば全面に使用）
import { jsPDF } from "jspdf";

export interface ConsentPdfInput {
  clinicName: string;
  patientName: string;
  treatmentName: string;
  amount: number;
  disclaimerText: string;
  signedDate: string;
  snapshotDataUrl?: string | null; // クライアントで html2canvas 等により生成した同意書画像
}

function dataUrlToImage(dataUrl: string): { format: string; data: string } | null {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  return { format: m[1].toUpperCase() === "JPG" ? "JPEG" : m[1].toUpperCase(), data: m[2] };
}

export function generateConsentPdf(input: ConsentPdfInput): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // クライアントで生成した同意書スナップショット画像があれば、それを全面に貼る
  // （日本語フォント問題を回避しつつ「見た目そのまま」を保存する）。
  if (input.snapshotDataUrl) {
    const img = dataUrlToImage(input.snapshotDataUrl);
    if (img) {
      const margin = 24;
      const imgW = pageW - margin * 2;
      // アスペクト比はクライアント側で縦長に調整済みと仮定し、高さは自動でページ内に収める
      const props = doc.getImageProperties(input.snapshotDataUrl);
      const ratio = props.height / props.width;
      let imgH = imgW * ratio;
      if (imgH > pageH - margin * 2) imgH = pageH - margin * 2;
      doc.addImage(input.snapshotDataUrl, img.format, margin, margin, imgW, imgH);
      return Buffer.from(doc.output("arraybuffer"));
    }
  }

  // フォールバック: テキストベース（英語ラベル＋値）。
  let y = 60;
  doc.setFontSize(18);
  doc.text("Informed Consent / Treatment Agreement", 40, y);
  y += 30;
  doc.setFontSize(11);
  const line = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 40, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 200, y);
    y += 22;
  };
  line("Clinic", input.clinicName);
  line("Patient", input.patientName);
  line("Date", input.signedDate);
  line("Treatment", input.treatmentName);
  line("Amount (JPY)", input.amount.toLocaleString());
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Disclaimer", 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const wrapped = doc.splitTextToSize(input.disclaimerText || "", pageW - 80);
  doc.text(wrapped, 40, y);
  return Buffer.from(doc.output("arraybuffer"));
}
