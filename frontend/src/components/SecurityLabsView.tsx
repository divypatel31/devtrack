import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Terminal,
  Flag,
  Plus,
  Check,
  Lock,
  Copy,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import type { Habit } from '../types/habit';

interface SecurityLabsViewProps {
  habits: Habit[];
  onQuickCreateLab: (title: string) => Promise<void>;
  onSubmitLabProof: (habitId: string, proofNote: string) => Promise<void>;
  onUncheckLab: (habitId: string) => Promise<void>;
  onDeleteLab: (habitId: string) => Promise<void>;
}

const SECURITY_LAB_TEMPLATES = [
  {
    title: 'Complete 1 TryHackMe Room',
    tool: 'TryHackMe / OpenVPN',
    difficulty: 'Medium',
    desc: 'Connect via OpenVPN, enumerate target machine, and capture user/root flags.',
  },
  {
    title: 'Nmap Recon & Port Enumeration Lab',
    tool: 'Nmap',
    difficulty: 'Easy',
    desc: 'Run service & version detection (-sC -sV) and document open attack vectors.',
  },
  {
    title: 'Metasploit Exploitation Practice',
    tool: 'Metasploit',
    difficulty: 'Hard',
    desc: 'Identify CVE matching service version, configure payload, and gain shell access.',
  },
  {
    title: 'Hydra Auth Brute-Force Audit',
    tool: 'Hydra',
    difficulty: 'Medium',
    desc: 'Test SSH/HTTP login resilience against dictionary wordlists (rockyou.txt).',
  },
];

const RECON_SNIPPETS = [
  { label: 'Full SYN + Scripts Scan', cmd: 'nmap -sC -sV -T4 -p- <TARGET_IP>' },
  { label: 'SSH Wordlist Audit (Hydra)', cmd: 'hydra -l admin -P rockyou.txt ssh://<TARGET_IP>' },
  { label: 'OpenVPN Lab Tunnel', cmd: 'sudo openvpn --config divy_thm.ovpn' },
];

export function SecurityLabsView({
  habits,
  onQuickCreateLab,
  onSubmitLabProof,
  onUncheckLab,
  onDeleteLab,
}: SecurityLabsViewProps) {
  const [activeProofId, setActiveProofId] = useState<string | null>(null);
  const [flagOrProof, setFlagOrProof] = useState<string>('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [creatingTitle, setCreatingTitle] = useState<string | null>(null);

  const securityHabits = habits.filter((h) => h.category === 'Cybersecurity');
  const completedLabsToday = securityHabits.filter((h) => h.completedToday).length;

  function copyCommand(cmd: string) {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 1800);
  }

  async function handleDeployTemplate(title: string) {
    setCreatingTitle(title);
    try {
      await onQuickCreateLab(title);
    } finally {
      setCreatingTitle(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Top Security Banner */}
      <div className="bg-gradient-to-r from-[#151621] via-[#181b2c] to-[#151621] border border-emerald-500/25 rounded-[26px] p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white">
                Cybersecurity & Red-Team Labs
              </h2>
              <span className="text-[10.5px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                CTF Proof Mode
              </span>
            </div>
            <p className="text-xs text-[#8b8d9f] mt-1">
              Track daily TryHackMe rooms, Nmap reconnaissance, Metasploit labs, and log captured
              flags or writeup notes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 bg-[#0e0f15] px-5 py-3 rounded-2xl border border-white/[0.05]">
          <div>
            <div className="text-2xl font-extrabold text-emerald-400">
              {completedLabsToday}/{securityHabits.length}
            </div>
            <div className="text-[10.5px] text-[#7c7f93] uppercase font-bold">
              Labs Pwned Today
            </div>
          </div>
        </div>
      </div>

      {/* Active Security Lab Goals + Quick Recon Cheat Sheet */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left 8 Cols: Active Security Labs */}
        <div className="xl:col-span-8 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[16px] font-bold text-white">
              Active Security Lab Goals ({securityHabits.length})
            </h3>
            <span className="text-xs text-[#7c7f93] flex items-center gap-1">
              <Flag className="w-3.5 h-3.5 text-emerald-400" /> Flag / Writeup Proof Required
            </span>
          </div>

          {securityHabits.length === 0 ? (
            <div className="bg-[#151621] border border-dashed border-white/10 rounded-[26px] p-8 text-center">
              <Shield className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-white">No active Security Labs yet</p>
              <p className="text-xs text-[#7c7f93] mt-1">
                Click any of the 1-Click Offensive Security Lab Templates below to add it to your daily routine!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {securityHabits.map((lab) => {
                const isProofOpen = activeProofId === lab.id;
                return (
                  <div
                    key={lab.id}
                    className={`rounded-[24px] p-5 flex flex-col justify-between border transition ${
                      lab.completedToday
                        ? 'bg-gradient-to-br from-emerald-950/30 to-[#151621] border-emerald-500/40'
                        : 'bg-[#151621] border-white/[0.06]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10.5px] font-bold uppercase px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300">
                          🛡️ Security Lab • 🔥 {lab.currentStreak}d
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteLab(lab.id)}
                          className="text-[#6c6f82] hover:text-rose-400 transition cursor-pointer"
                          title="Delete lab goal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h4 className="text-[15.5px] font-bold text-white mb-1">{lab.title}</h4>
                      <p className="text-xs text-[#8b8d9f]">
                        {lab.todayNote ? (
                          <span className="text-emerald-300 font-medium">
                            🚩 Proof: "{lab.todayNote}"
                          </span>
                        ) : (
                          'Submit THM room name, CVE, or captured flag note to verify.'
                        )}
                      </p>

                      {isProofOpen && (
                        <div className="mt-3 p-3 rounded-2xl bg-[#0e0f15] border border-emerald-500/40">
                          <input
                            type="text"
                            value={flagOrProof}
                            onChange={(e) => setFlagOrProof(e.target.value)}
                            placeholder="e.g., Completed THM Pickle Rick / Flag{...}"
                            className="w-full bg-transparent text-xs text-white focus:outline-none mb-2"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveProofId(null)}
                              className="text-[11px] text-[#7c7f93] hover:text-white px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await onSubmitLabProof(lab.id, flagOrProof);
                                setActiveProofId(null);
                                setFlagOrProof('');
                              }}
                              className="text-[11px] font-bold px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 cursor-pointer"
                            >
                              Verify Flag / Lab
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/[0.05]">
                      <div className="flex items-center gap-1">
                        {lab.weeklyProgress.map((d, i) => {
                          const isToday = i === lab.weeklyProgress.length - 1;
                          return (
                            <span
                              key={d.date}
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                d.completed
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : isToday
                                  ? 'bg-white/10 text-white'
                                  : 'bg-[#0e0f15] text-[#565869]'
                              }`}
                            >
                              {d.completed ? '✓' : isToday ? '◎' : '🔒'}
                            </span>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (lab.completedToday) {
                            onUncheckLab(lab.id);
                          } else {
                            setActiveProofId(lab.id);
                            setFlagOrProof('');
                          }
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                          lab.completedToday
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-[#6c47ff] hover:bg-[#5936e8] text-white'
                        }`}
                      >
                        {lab.completedToday ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Pwned</span>
                          </>
                        ) : (
                          <>
                            <Flag className="w-3.5 h-3.5" />
                            <span>Log Flag</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 1-Click Security Lab Templates */}
          <div className="pt-3">
            <h3 className="text-sm font-bold text-white mb-3">
              1-Click Offensive Security Lab Presets
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SECURITY_LAB_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.title}
                  className="bg-[#151621] border border-white/[0.05] hover:border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between gap-3 transition"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-emerald-400">{tpl.tool}</span>
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[#9ca0b5]">
                        {tpl.difficulty}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{tpl.title}</h4>
                    <p className="text-xs text-[#7c7f93] mt-1">{tpl.desc}</p>
                  </div>
                  <button
                    type="button"
                    disabled={creatingTitle === tpl.title}
                    onClick={() => handleDeployTemplate(tpl.title)}
                    className="w-full py-2 rounded-xl bg-[#1e2030] hover:bg-emerald-500 hover:text-slate-950 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {creatingTitle === tpl.title ? 'Deploying Lab...' : 'Add Lab to Routine'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Red-Team CLI Quick Reference */}
        <div className="xl:col-span-4 space-y-5">
          <div className="bg-[#151621] border border-white/[0.05] rounded-[26px] p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <h3 className="text-[15.5px] font-bold text-white">Recon CLI Quick Reference</h3>
            </div>
            <p className="text-xs text-[#7c7f93] mb-4">
              Click any snippet to copy for your TryHackMe / HackTheBox terminal session:
            </p>

            <div className="space-y-3">
              {RECON_SNIPPETS.map((item) => (
                <div
                  key={item.label}
                  onClick={() => copyCommand(item.cmd)}
                  className="p-3 rounded-2xl bg-[#0e0f15] border border-white/[0.05] hover:border-emerald-500/40 cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#8b8d9f] mb-1">
                    <span>{item.label}</span>
                    {copiedCmd === item.cmd ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Copied
                      </span>
                    ) : (
                      <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                    )}
                  </div>
                  <code className="text-xs text-emerald-300 font-mono break-all">{item.cmd}</code>
                </div>
              ))}
            </div>

            <div className="mt-6 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Anti-Cheat Policy:</strong> Security labs require logging the room name,
                CVE identifier, or captured flag hash before today's streak increments.
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}