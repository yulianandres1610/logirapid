'use client'

interface Parameter {
  name: string
  type: string
  required: boolean
  description: string
  default?: string
}

interface ParameterTableProps {
  parameters: Parameter[]
  title?: string
}

export default function ParameterTable({ parameters, title }: ParameterTableProps) {
  if (parameters.length === 0) return null

  return (
    <div className="mt-6">
      {title && (
        <h4 className="text-sm font-semibold text-white mb-3">{title}</h4>
      )}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Parametro</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Descripcion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {parameters.map((param) => (
              <tr key={param.name} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <code className="text-[#cc0a46] font-mono text-sm">{param.name}</code>
                    {param.required && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 rounded">
                        requerido
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <code className="text-blue-400 font-mono text-xs bg-blue-500/10 px-2 py-1 rounded">
                    {param.type}
                  </code>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {param.description}
                  {param.default && (
                    <span className="ml-2 text-gray-500">
                      Default: <code className="text-gray-400">{param.default}</code>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
