import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { makeCard } from "./shareCard.js";
import { Ico } from "./icons.jsx";

const toBlob = (cv) => new Promise((ok) => cv.toBlob(ok, "image/png"));

export default function ShareModal({ shot, url, rows, base, onClose }) {
  const [img, setImg] = useState(null);
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    makeCard({ shot, url, rows, base }).then(async (cv) => {
      if (!alive) return;
      setImg(cv.toDataURL("image/png"));
      const b = await toBlob(cv);
      if (alive && b) setFile(new File([b], "kuhnya-promebel.png", { type: "image/png" }));
    });
    return () => { alive = false; };
  }, [shot, url]);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const text = `Моя кухня в PRO MEBEL: ${url}`;
  const canNative = !!(file && navigator.canShare?.({ files: [file] }));
  const download = () => {
    const a = document.createElement("a");
    a.href = img;
    a.download = "kuhnya-promebel.png";
    a.click();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch {
      const t = document.createElement("textarea");
      t.value = url;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const native = () => navigator.share({ files: [file], text }).catch(() => {});
  const whatsapp = () => window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");

  return (
    <div className="sh-back" onClick={onClose}>
      <div className="sh-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Поделиться кухней">
        <button className="sh-x" aria-label="Закрыть" onClick={onClose}>×</button>
        <div className="sh-prev">{img ? <img src={img} alt="Карточка кухни с QR-кодом" /> : <span className="muted">Готовлю карточку…</span>}</div>
        <div className="sh-acts">
          <button className="btn dark" disabled={!img} onClick={download}>Скачать картинку</button>
          <button className="btn" disabled={!img} onClick={() => window.print()}>Печать</button>
          {canNative && <button className="btn" onClick={native}>Отправить…</button>}
          <button className="btn" onClick={whatsapp}>WhatsApp</button>
          <button className="btn" onClick={copy}><Ico name="qr" size={16} />{copied ? "Скопировано" : "Копировать ссылку"}</button>
        </div>
      </div>
      {img && createPortal(<img className="print-sheet" src={img} alt="" />, document.body)}
    </div>
  );
}
