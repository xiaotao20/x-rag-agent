'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  Code2,
  Database,
  FileText,
  GraduationCap,
  Headphones,
  Layers,
  LockKeyhole,
  Quote,
  Scale,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import LoginModal from './LoginModal'
import { getMe } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

const NAV_ITEMS = [
  { href: '#features', label: '产品能力' },
  { href: '#use-cases', label: '应用领域' },
  { href: '#how-it-works', label: '工作原理' },
  { href: '#security', label: '安全' },
]

const FEATURES = [
  {
    icon: Database,
    title: '多格式知识入库',
    description: 'PDF、Markdown、TXT 统一解析、切分和向量化，快速沉淀团队资料。',
    tag: 'INGEST',
  },
  {
    icon: Search,
    title: '混合检索',
    description: '向量语义召回 + BM25 关键词召回，RRF 融合，兼顾语义与精确词。',
    tag: 'HYBRID',
  },
  {
    icon: Layers,
    title: 'Rerank 精排',
    description: '对候选片段二次排序，把最相关的证据放在模型上下文最前面。',
    tag: 'RERANK',
  },
  {
    icon: Quote,
    title: '引用可追溯',
    description: '每条回答附带来源片段，点击即可核对原文，降低幻觉风险。',
    tag: 'CITATION',
  },
] as const

const USE_CASES = [
  {
    icon: Building2,
    title: '企业知识库',
    description: '制度、流程、产品资料统一问答，新员工也能快速找到答案。',
  },
  {
    icon: Headphones,
    title: '智能客服',
    description: '基于知识库生成可引用的回复，减少重复问题和人工转接。',
  },
  {
    icon: Code2,
    title: '研发文档',
    description: 'API、架构、运维手册快速定位，让技术资料真正被用起来。',
  },
  {
    icon: Briefcase,
    title: '销售售前',
    description: '方案、案例、报价口径随时可查，现场回答更有依据。',
  },
  {
    icon: GraduationCap,
    title: '培训学习',
    description: '把培训材料变成可对话的导师，按需追问、逐层深入。',
  },
  {
    icon: Scale,
    title: '合规审计',
    description: '条款、规范和历史记录可追溯，关键结论能回到原文。',
  },
] as const

const STEPS = [
  {
    title: '上传资料',
    description: '把 PDF、Markdown 或 TXT 拖进知识库。',
  },
  {
    title: '解析切分',
    description: '自动提取文本、切分片段并生成向量。',
  },
  {
    title: '混合召回与重排',
    description: '向量 + BM25 召回，RRF 融合后精排。',
  },
  {
    title: 'Agent 回答',
    description: '结合证据生成答案，并返回可点击的引用来源。',
  },
]

/** 落地页区块标题。 */
function SectionHeading({
  label,
  title,
  description,
}: {
  label: string
  title: string
  description: string
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-300/80">
        {label}
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-400">{description}</p>
    </div>
  )
}

/** 产品落地页布局和登录弹窗状态。 */
export default function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('login') === '1') setLoginOpen(true)
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  return (
    <div id="top" className="relative min-h-dvh overflow-x-hidden bg-[#050816] text-white">
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/landing-bg.svg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050816]/60 via-[#050816]/78 to-[#050816]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 18% 8%, rgba(34,211,238,0.14), transparent 34%), radial-gradient(circle at 82% 18%, rgba(99,102,241,0.12), transparent 30%)',
          }}
        />
      </div>

      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-[#050816]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500 text-slate-950 shadow-[0_0_26px_-6px_rgba(34,211,238,0.9)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">X RAG</span>
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[12px] text-slate-400 transition-colors hover:text-cyan-200"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {user ? (
            <a
              href="/chat"
              className="group inline-flex h-9 items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 text-[12px] font-medium text-cyan-100 transition-colors hover:border-cyan-200/60 hover:bg-cyan-300/10"
            >
              进入工作台
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="group inline-flex h-9 items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 text-[12px] font-medium text-cyan-100 transition-colors hover:border-cyan-200/60 hover:bg-cyan-300/10"
            >
              登录
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-32 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-40">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-[11px] text-cyan-100/90">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
              RAG · 混合检索 · 引用溯源
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              让企业知识
              <span className="block bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-300 bg-clip-text text-transparent">
                随问随答
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-8 text-slate-400">
              把散落在文档、手册和内部资料里的知识，变成可检索、可追溯、可对话的团队资产。
              从混合召回到 Agent 回答，让每一次提问都有据可查。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <a
                  href="/chat"
                  className="group inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-blue-500 px-5 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_-16px_rgba(34,211,238,0.8)] transition-transform hover:-translate-y-0.5"
                >
                  进入工作台
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="group inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-blue-500 px-5 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_-16px_rgba(34,211,238,0.8)] transition-transform hover:-translate-y-0.5"
                >
                  立即体验
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
              <a
                href="#features"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-medium text-slate-300 transition-colors hover:border-white/25 hover:text-white"
              >
                查看产品能力
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[12px] text-slate-500">
              {['混合召回', '重排精炼', '引用可追溯', '私有化部署'].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-cyan-300" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-[2.5rem] bg-cyan-400/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-2.5 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
              <div className="rounded-2xl border border-white/10 bg-[#070d1f] p-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                    <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                    <span className="ml-2 text-[11px] text-slate-500">knowledge-agent</span>
                  </div>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
                    在线
                  </span>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="max-w-[82%] rounded-2xl rounded-br-md bg-slate-100 px-3.5 py-2.5 text-[12px] leading-6 text-slate-800">
                    新员工入职需要准备什么？
                  </div>
                </div>

                <div className="mt-3 flex gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400">
                      <Search className="h-3 w-3 text-cyan-300" />
                      检索知识库 · 混合召回 12 个片段
                    </div>
                    <div className="rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.035] px-3.5 py-3 text-[12px] leading-6 text-slate-300">
                      入职第一天需要完成账号开通、设备领取和安全培训。建议先阅读《新员工入职指南》第 2 章。
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {['新员工入职指南.md', '信息安全规范.pdf'].map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-1 text-[10px] text-cyan-200/90"
                        >
                          <FileText className="h-3 w-3" />
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                  基于 RAG 与引用溯源生成
                </div>
              </div>
            </div>

            <div className="animate-float absolute -bottom-5 -left-4 hidden rounded-xl border border-white/10 bg-[#0a1228]/90 px-3 py-2 text-[11px] text-slate-300 shadow-xl backdrop-blur-xl sm:block">
              <span className="text-cyan-300">RRF</span> 融合排序
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <SectionHeading
            label="Product"
            title="从文档到答案，一条完整链路"
            description="不是简单的关键词搜索，而是从入库、召回、精排到生成答案的完整 RAG 流程。"
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description, tag }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition-all hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-white/[0.05]"
              >
                <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[9px] font-medium tracking-[0.22em] text-slate-600">{tag}</span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-[12px] leading-6 text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="use-cases" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <SectionHeading
            label="Use cases"
            title="让知识在真实业务里流动"
            description="从内部知识库到客户服务，同一套检索与问答能力可以复用在多个场景。"
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.045] to-white/[0.02] p-5 transition-colors hover:border-violet-300/25"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-300/20 bg-violet-300/[0.07] text-violet-200">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-[12px] leading-6 text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <SectionHeading
            label="How it works"
            title="四步，把资料变成答案"
            description="保留原始文档的可追溯性，同时让检索和生成过程足够轻量。"
          />

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                {index < STEPS.length - 1 && (
                  <div className="absolute -right-2 top-9 hidden h-px w-4 bg-gradient-to-r from-cyan-300/40 to-transparent md:block" />
                )}
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] text-[11px] font-semibold text-cyan-200">
                  0{index + 1}
                </span>
                <h3 className="mt-4 text-sm font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-[12px] leading-6 text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="security" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="grid gap-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-300/80">
                Security
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                知识可以开放，
                <span className="block text-slate-400">权限不能缺席</span>
              </h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-slate-400">
                从部署方式到引用链路，按企业知识的边界设计，避免把内部资料变成新的风险面。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, title: '权限隔离', text: '按用户与文档控制访问范围。' },
                { icon: Server, title: '私有化部署', text: '数据与模型都留在可控环境。' },
                { icon: LockKeyhole, title: '审计追溯', text: '登录与检索行为可记录、可回溯。' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-[#070d1f]/70 p-4">
                  <Icon className="h-5 w-5 text-cyan-300" />
                  <h3 className="mt-3 text-[12px] font-semibold text-white">{title}</h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 pt-8 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 via-blue-500/10 to-violet-500/10 px-6 py-12 text-center sm:px-10">
            <div className="absolute left-1/2 top-0 h-32 w-80 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                准备好让知识库开始工作了吗？
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">
                上传第一份文档，体验混合检索、引用溯源和 Agent 问答。
              </p>
              {user ? (
                <a
                  href="/chat"
                  className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
                >
                  进入工作台
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
                >
                  登录并开始
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            <span>X RAG Agent</span>
            <span className="text-slate-700">/</span>
            <span>FastAPI · LangChain · Chroma</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="transition-colors hover:text-slate-300">产品能力</a>
            <a href="#security" className="transition-colors hover:text-slate-300">安全</a>
            {user ? (
              <a href="/chat" className="transition-colors hover:text-slate-300">工作台</a>
            ) : (
              <button type="button" onClick={() => setLoginOpen(true)} className="transition-colors hover:text-slate-300">
                登录
              </button>
            )}
          </div>
        </div>
      </footer>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  )
}
