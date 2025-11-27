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

  const lines = examples[activeTab].code.split('\n')

  return (
    <div className="rounded-lg overflow-hidden bg-[#0d1117] border border-white/10">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 bg-[#161b22]">
        <div className="flex items-center overflow-x-auto scrollbar-hide">
          {title && (
            <span className="px-4 py-2.5 text-xs font-medium text-gray-400 border-r border-white/10 whitespace-nowrap">
              {title}
            </span>
          )}
          <div className="flex">
            {examples.map((example, index) => (
              <button
                key={example.language}
                onClick={() => setActiveTab(index)}
                className={`
                  px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap
                  ${activeTab === index
                    ? `${languageColors[example.language] || 'text-white'} bg-[#0d1117] border-b-2 border-current`
                    : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'
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
          className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 border-t sm:border-t-0 border-white/10"
          title="Copiar codigo"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-xs text-green-400">Copiado!</span>
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
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed font-mono">
          <code className="text-gray-300">
            {lines.map((line, index) => (
              <div key={index} className="flex">
                <span className="w-8 pr-4 text-gray-600 select-none text-right shrink-0">
                  {index + 1}
                </span>
                <span className="whitespace-pre">{line || ' '}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}
