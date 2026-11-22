import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, X } from 'lucide-react';
import { loginAdminWithPassword } from '../lib/adminSession';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticatedAdmin: () => void;
}

export function AdminLoginModal({
  isOpen,
  onClose,
  onAuthenticatedAdmin,
}: AdminLoginModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!password) {
      setErrorMsg('Digite a senha de administrador.');
      return;
    }

    setLoading(true);
    try {
      const result = await loginAdminWithPassword(password);
      if (!result.ok) {
        setErrorMsg(result.error || 'Senha incorreta. Tente novamente.');
        return;
      }
      setPassword('');
      onAuthenticatedAdmin();
    } catch {
      setErrorMsg('Erro ao validar a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Login do Administrador"
    >
      <div className="relative w-full max-w-md bg-[#FAF6F0] rounded-2xl border border-[#2A1E17]/15 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 bg-white border-b border-[#2A1E17]/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#A64B2A]/10 text-[#A64B2A] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#2A1E17] leading-none">
                Área do Administrador
              </h2>
              <p className="text-xs text-[#6C5B4F] mt-1">Osteria del Nonno</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-[#F3ECE2] flex items-center justify-center text-[#2A1E17] cursor-pointer"
            aria-label="Fechar janela de login"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-[#6C5B4F]">
            Digite a senha de acesso para gerenciar o cardápio, fotos, WhatsApp e personalização do site.
          </p>

          <div>
            <label
              htmlFor="admin-password-only"
              className="block text-xs font-semibold text-[#2A1E17] mb-1.5"
            >
              Senha de Administrador
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6C5B4F]" />
              <input
                id="admin-password-only"
                type={showPassword ? 'text' : 'password'}
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha"
                className="w-full pl-10 pr-11 py-3 rounded-xl bg-white border border-[#2A1E17]/15 text-sm text-[#2A1E17] focus:outline-none focus:ring-2 focus:ring-[#A64B2A]/35"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6C5B4F] hover:text-[#2A1E17] cursor-pointer"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[#A64B2A] hover:opacity-95 text-white text-sm font-semibold transition-opacity cursor-pointer disabled:opacity-60 min-h-[46px]"
          >
            {loading ? 'Verificando...' : 'Entrar no Painel'}
          </button>
        </form>
      </div>
    </div>
  );
}
