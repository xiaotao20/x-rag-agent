import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cx } from '@/lib/utils'

const components: Components = {
  p: ({ node: _node, ...props }) => (
    <p className="mb-3 leading-7 last:mb-0" {...props} />
  ),
  h1: ({ node: _node, ...props }) => (
    <h1 className="mb-2 mt-5 text-[19px] font-semibold tracking-tight first:mt-0" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="mb-2 mt-5 text-[16px] font-semibold tracking-tight first:mt-0" {...props} />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="mb-1.5 mt-4 text-[14px] font-semibold first:mt-0" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li className="pl-0.5" {...props} />,
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="my-3 rounded-r-lg border-l-2 border-accent/30 bg-accent-soft/40 py-1.5 pl-3 text-muted"
      {...props}
    />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent"
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  ),
  code: ({ node: _node, className, children, ...props }) => {
    const text = String(children ?? '')
    const isBlock = Boolean(className?.startsWith('language-')) || text.includes('\n')
    if (isBlock) {
      return (
        <code
          className={cx('font-mono text-[13px] leading-6', className)}
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded-md border border-line bg-subtle px-1.5 py-0.5 font-mono text-[0.86em]"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ node: _node, ...props }) => (
    <pre
      className="mb-4 overflow-x-auto rounded-xl border border-white/10 bg-[#1e1e1b] p-4 text-[13px] leading-6 text-[#f4f4f0]"
      {...props}
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-[13px]" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => (
    <thead className="bg-canvas/70" {...props} />
  ),
  th: ({ node: _node, ...props }) => (
    <th className="border-b border-line px-2.5 py-1.5 text-left font-medium" {...props} />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border-b border-line px-2.5 py-1.5 align-top last:border-b-0" {...props} />
  ),
  hr: ({ node: _node, ...props }) => <hr className="my-5 border-line" {...props} />,
  img: ({ node: _node, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="my-2 max-w-full rounded-lg border border-line" {...props} />
  ),
  input: ({ node: _node, ...props }) => (
    <input className="mr-1.5 align-middle accent-[#3b5bdb]" {...props} />
  ),
}

export default function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
