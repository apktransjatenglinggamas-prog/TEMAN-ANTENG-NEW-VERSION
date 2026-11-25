import { useState } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import { buildWhatsAppSendUrl, salinTeksClipboard } from '../utils/anteng';

interface WhatsAppShareBoxProps {
  message: string;
  onCopied: (ok: boolean) => void;
}

export function WhatsAppShareBox({ message, onCopied }: WhatsAppShareBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await salinTeksClipboard(message);
    onCopied(ok);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 space-y-2.5">
      <a
        href={buildWhatsAppSendUrl(message)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-emerald-600 text-white font-extrabold text-base flex items-center justify-center gap-2 no-underline shadow-sm"
      >
        <Send className="w-4 h-4" /> KIRIM KE WA GROUP
      </a>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-emerald-100 border-2 border-emerald-500 text-emerald-900 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
        {copied ? 'PESAN WA TERSALIN' : 'SALIN PESAN WA (CADANGAN)'}
      </button>

      <pre className="bg-white border border-emerald-200 rounded-xl p-2.5 text-[11px] font-sans text-slate-700 whitespace-pre-wrap break-words leading-relaxed max-h-40 overflow-y-auto">
        {message}
      </pre>
    </div>
  );
}
