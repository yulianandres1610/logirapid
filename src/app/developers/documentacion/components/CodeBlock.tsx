'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeExample {
  language: string
  label: string
  code: string
}

interface CodeBlockProps {
  examples: CodeExample[]
  title?: string
}

const languageColors: Record<string, string> = {
  curl: 'text-green-400',
  javascript: 'text-yellow-400',
  typescript: 'text-blue-400',
  python: 'text-blue-300',
  php: 'text-purple-400',
  swift: 'text-orange-400',
  kotlin: 'text-purple-300',
  dart: 'text-cyan-400',
  go: 'text-cyan-300',
}

export default function CodeBlock({ examples, title }: CodeBlockProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(examples[activeTab].code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  return (
    <div className="rounded-lg overflow-hidden bg-[#1a1f2e] border border-white/10">
      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0d1117]">
        <div className="flex items-center">
          {title && (
            <span className="px-4 py-2 text-xs font-medium text-gray-400 border-r border-white/10">
              {title}
            </span>
          )}
          <div className="flex">
            {examples.map((example, index) => (
              <button
                key={example.language}
                onClick={() => setActiveTab(index)}
                className={`
                  px-4 py-2 text-xs font-medium transition-colors
                  ${activeTab === index
                    ? `${languageColors[example.language] || 'text-white'} bg-[#1a1f2e]`
                    : 'text-gray-500 hover:text-gray-300'
                  }
                `}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="px-3 py-2 text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
          title="Copiar codigo"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-xs text-green-400">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span className="text-xs">Copiar</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm leading-relaxed">
          <code className="text-gray-300 font-mono whitespace-pre">
            {examples[activeTab].code}
          </code>
        </pre>
      </div>
    </div>
  )
}
