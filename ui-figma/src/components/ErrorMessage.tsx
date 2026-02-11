import { AlertCircle } from 'lucide-react';

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-5 py-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#FEF3F3] rounded-lg border border-[#FFDDDD]">
        <AlertCircle className="w-4 h-4 text-[#CC6666]" />
        <span className="text-[12px] text-[#CC6666]">{message}</span>
      </div>
    </div>
  );
}
