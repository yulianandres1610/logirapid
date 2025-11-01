'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  Search,
  Filter,
  Plus,
  Calendar,
  User,
  Building2,
  Shield,
  AlertCircle,
  Check,
  X,
  File,
  FolderOpen,
  FileCheck,
  Clock,
  Tag,
  Archive,
  TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'

// Mock data for documents
const MOCK_DOCUMENTS = [
  {
    id: 1,
    name: "Contrato de Arrendamiento Sucursal Central",
    type: "contract",
    category: "legal",
    status: "approved",
    uploadDate: "2024-01-15",
    expiryDate: "2025-01-15",
    uploadedBy: "Carlos Pérez",
    size: "2.4 MB",
    url: "/documents/contract_central.pdf",
    tags: ["arrendamiento", "legal", "central"],
    description: "Contrato de arrendamiento para la sucursal principal de la empresa"
  },
  {
    id: 2,
    name: "Licencia de Operación",
    type: "license",
    category: "legal",
    status: "approved",
    uploadDate: "2024-01-10",
    expiryDate: "2024-12-31",
    uploadedBy: "María González",
    size: "1.8 MB",
    url: "/documents/license_2024.pdf",
    tags: ["licencia", "operación", "vigente"],
    description: "Licencia comercial actualizada para el presente año"
  },
  {
    id: 3,
    name: "Plan de Negocios 2024",
    type: "plan",
    category: "business",
    status: "approved",
    uploadDate: "2024-01-05",
    expiryDate: "2024-12-31",
    uploadedBy: "Luis Martínez",
    size: "3.2 MB",
    url: "/documents/business_plan_2024.pdf",
    tags: ["negocios", "2024", "estratégico"],
    description: "Plan estratégico de negocios para el año fiscal 2024"
  },
  {
    id: 4,
    name: "Políticas de Privacidad",
    type: "policy",
    category: "compliance",
    status: "active",
    uploadDate: "2024-01-01",
    expiryDate: null,
    uploadedBy: "Ana López",
    size: "856 KB",
    url: "/documents/privacy_policy.pdf",
    tags: ["privacidad", "compliance", "vigente"],
    description: "Políticas de privacidad y tratamiento de datos personales"
  },
  {
    id: 5,
    name: "Manuales de Procedimiento",
    type: "manual",
    category: "operations",
    status: "active",
    uploadDate: "2023-12-15",
    expiryDate: null,
    uploadedBy: "Carlos Pérez",
    size: "4.5 MB",
    url: "/documents/procedures_manual.pdf",
    tags: ["procedimientos", "operaciones", "guía"],
    description: "Manuales actualizados de procedimientos operativos"
  },
  {
    id: 6,
    name: "Reportes Financieros Q4 2023",
    type: "report",
    category: "financial",
    status: "active",
    uploadDate: "2024-01-02",
    expiryDate: null,
    uploadedBy: "María González",
    size: "1.2 MB",
    url: "/documents/financial_report_q4_2023.pdf",
    tags: ["financiero", "reporte", "Q4-2023"],
    description: "Reporte financiero del cuarto trimestre de 2023"
  }
]

// Document types
const DOCUMENT_TYPES = [
  { id: 'contract', name: 'Contratos', icon: FileText, color: 'blue' },
  { id: 'license', name: 'Licencias', icon: Shield, color: 'green' },
  { id: 'plan', name: 'Planes', icon: FileCheck, color: 'purple' },
  { id: 'policy', name: 'Políticas', icon: Archive, color: 'orange' },
  { id: 'manual', name: 'Manuales', icon: FolderOpen, color: 'teal' },
  { id: 'report', name: 'Reportes', icon: TrendingUp, color: 'pink' }
]

// Document categories
const DOCUMENT_CATEGORIES = [
  { id: 'legal', name: 'Legal', color: 'blue' },
  { id: 'business', name: 'Negocios', color: 'green' },
  { id: 'compliance', name: 'Cumplimiento', color: 'orange' },
  { id: 'operations', name: 'Operaciones', color: 'teal' },
  { id: 'financial', name: 'Financiero', color: 'purple' }
]

// Document status
const DOCUMENT_STATUS = [
  { id: 'active', name: 'Activo', color: 'green' },
  { id: 'approved', name: 'Aprobado', color: 'blue' },
  { id: 'pending', name: 'Pendiente', color: 'yellow' },
  { id: 'expired', name: 'Expirado', color: 'red' }
]

export default function AgencyAdminDocuments() {
  const { theme } = useTheme()
  const [documents, setDocuments] = useState(MOCK_DOCUMENTS)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedDocument, setSelectedDocument] = useState<typeof MOCK_DOCUMENTS[0] | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.uploadedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesType = selectedType === 'all' || doc.type === selectedType
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory
    const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus

    return matchesSearch && matchesType && matchesCategory && matchesStatus
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return theme === 'dark' ? 'text-green-400 bg-green-400/10' : 'text-green-600 bg-green-50 border-green-200'
      case 'approved': return theme === 'dark' ? 'text-blue-400 bg-blue-400/10' : 'text-blue-600 bg-blue-50 border-blue-200'
      case 'pending': return theme === 'dark' ? 'text-yellow-400 bg-yellow-400/10' : 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'expired': return theme === 'dark' ? 'text-red-400 bg-red-400/10' : 'text-red-600 bg-red-50 border-red-200'
      default: return theme === 'dark' ? 'text-gray-400 bg-gray-400/10' : 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getTypeIcon = (type: string) => {
    const typeInfo = DOCUMENT_TYPES.find(t => t.id === type)
    return typeInfo?.icon || FileText
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className={cn(
                "text-3xl font-bold mb-2",
                theme === 'dark' ? "text-white" : "text-black"
              )}>
                Documentos de la Empresa
              </h1>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Gestiona todos los documentos de tu organización
              </p>
            </div>

            <Button
              onClick={() => setShowUploadModal(true)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                theme === 'dark' ? "bg-exa-secondary text-white hover:bg-exa-secondary/90" : "bg-exa-primary text-white hover:bg-exa-primary/90"
              )}
            >
              <Upload className="w-5 h-5" />
              Subir Documento
            </Button>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={cn(
                "backdrop-blur-sm border rounded-2xl p-6 hover:shadow-xl transition-all duration-300",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-100"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-xl transition-all duration-300",
                  theme === 'dark' ? "bg-blue-600/20" : "bg-blue-500/20"
                )}>
                  <FileText className={cn(
                    "w-6 h-6 transition-all duration-300",
                    theme === 'dark' ? "text-blue-400" : "text-blue-600"
                  )} />
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-lg",
                  theme === 'dark' ? "text-blue-400 bg-blue-400/10" : "text-blue-600 bg-blue-50 border border-blue-200"
                )}>
                  +12%
                </span>
              </div>
              <h3 className={cn(
                "text-2xl font-bold mb-1",
                theme === 'dark' ? "text-white" : "text-black"
              )}>{documents.length}</h3>
              <p className={cn(
                "text-sm font-medium",
                theme === 'dark' ? "text-gray-400" : "text-black"
              )}>Total Documentos</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={cn(
                "backdrop-blur-sm border rounded-2xl p-6 hover:shadow-xl transition-all duration-300",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-100"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-xl transition-all duration-300",
                  theme === 'dark' ? "bg-green-500/20" : "bg-green-500/20"
                )}>
                  <FileCheck className={cn(
                    "w-6 h-6 transition-all duration-300",
                    theme === 'dark' ? "text-green-400" : "text-green-600"
                  )} />
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-lg",
                  theme === 'dark' ? "text-green-400 bg-green-400/10" : "text-green-600 bg-green-50 border border-green-200"
                )}>
                  +5%
                </span>
              </div>
              <h3 className={cn(
                "text-2xl font-bold mb-1",
                theme === 'dark' ? "text-white" : "text-black"
              )}>{documents.filter(d => d.status === 'active' || d.status === 'approved').length}</h3>
              <p className={cn(
                "text-sm font-medium",
                theme === 'dark' ? "text-gray-400" : "text-black"
              )}>Documentos Activos</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={cn(
                "backdrop-blur-sm border rounded-2xl p-6 hover:shadow-xl transition-all duration-300",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-100"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-xl transition-all duration-300",
                  theme === 'dark' ? "bg-purple-500/20" : "bg-purple-500/20"
                )}>
                  <Archive className={cn(
                    "w-6 h-6 transition-all duration-300",
                    theme === 'dark' ? "text-purple-400" : "text-purple-600"
                  )} />
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-lg",
                  theme === 'dark' ? "text-purple-400 bg-purple-400/10" : "text-purple-600 bg-purple-50 border border-purple-200"
                )}>
                  +8%
                </span>
              </div>
              <h3 className={cn(
                "text-2xl font-bold mb-1",
                theme === 'dark' ? "text-white" : "text-black"
              )}>4.2 GB</h3>
              <p className={cn(
                "text-sm font-medium",
                theme === 'dark' ? "text-gray-400" : "text-black"
              )}>Almacenamiento</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={cn(
                "backdrop-blur-sm border rounded-2xl p-6 hover:shadow-xl transition-all duration-300",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-100"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-xl transition-all duration-300",
                  theme === 'dark' ? "bg-orange-500/20" : "bg-orange-500/20"
                )}>
                  <Clock className={cn(
                    "w-6 h-6 transition-all duration-300",
                    theme === 'dark' ? "text-orange-400" : "text-orange-600"
                  )} />
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-lg",
                  theme === 'dark' ? "text-orange-400 bg-orange-400/10" : "text-orange-600 bg-orange-50 border border-orange-200"
                )}>
                  +3
                </span>
              </div>
              <h3 className={cn(
                "text-2xl font-bold mb-1",
                theme === 'dark' ? "text-white" : "text-black"
              )}>3</h3>
              <p className={cn(
                "text-sm font-medium",
                theme === 'dark' ? "text-gray-400" : "text-black"
              )}>Por Expirar</p>
            </motion.div>
          </div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={cn(
              "backdrop-blur-sm border rounded-2xl p-6",
              theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
            )}
          >
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className={cn(
                  "absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )} />
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                      : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                  )}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Type Filter */}
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className={cn(
                    "px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                      : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                  )}
                >
                  <option value="all">Todos los tipos</option>
                  {DOCUMENT_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={cn(
                    "px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                      : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                  )}
                >
                  <option value="all">Todas las categorías</option>
                  {DOCUMENT_CATEGORIES.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className={cn(
                    "px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                      : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                  )}
                >
                  <option value="all">Todos los estados</option>
                  {DOCUMENT_STATUS.map(status => (
                    <option key={status.id} value={status.id}>{status.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>

          {/* Documents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((document, index) => (
              <motion.div
                key={document.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={cn(
                  "backdrop-blur-sm border rounded-2xl p-6 hover:shadow-xl transition-all duration-300 cursor-pointer",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}
                onClick={() => setSelectedDocument(document)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/10"
                    )}>
                      {React.createElement(getTypeIcon(document.type), {
                        className: cn(
                          "w-6 h-6",
                          theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                        )
                      })}
                    </div>
                    <div>
                      <h3 className={cn(
                        "font-bold text-lg mb-1",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        {document.name}
                      </h3>
                      <div className="flex items-center gap-1">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          document.status === 'active' ? "bg-green-500" :
                          document.status === 'approved' ? "bg-blue-500" :
                          document.status === 'pending' ? "bg-yellow-500" : "bg-red-500"
                        )} />
                        <span className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          {DOCUMENT_STATUS.find(s => s.id === document.status)?.name}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-lg",
                      theme === 'dark' ? "bg-gray-700/20 text-gray-400" : "bg-gray-100 text-gray-600"
                    )}>
                      {DOCUMENT_TYPES.find(t => t.id === document.type)?.name}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className={cn(
                      "w-4 h-4",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )} />
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      {formatDate(document.uploadDate)}
                    </span>
                  </div>

                  {document.expiryDate && (
                    <div className="flex items-center gap-2">
                      <Clock className={cn(
                        "w-4 h-4",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )} />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Expira: {formatDate(document.expiryDate)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <User className={cn(
                      "w-4 h-4",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )} />
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      {document.uploadedBy}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <FileText className={cn(
                      "w-4 h-4",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )} />
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      {document.size}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {document.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        "px-2 py-1 rounded-full text-xs",
                        theme === 'dark' ? "bg-exa-secondary/20 text-exa-secondary" : "bg-exa-primary/10 text-exa-primary"
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Handle download
                    }}
                    className={cn(
                      "flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300",
                      theme === 'dark' ? "text-gray-400 hover:text-white hover:bg-gray-800" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Handle delete
                    }}
                    className={cn(
                      "flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300",
                      theme === 'dark' ? "text-gray-400 hover:text-red-400 hover:bg-red-900/20" : "text-gray-600 hover:text-red-600 hover:bg-red-50"
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Document Detail Modal */}
          <AnimatePresence>
            {selectedDocument && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setSelectedDocument(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6",
                    theme === 'dark' ? "bg-gray-900" : "bg-white"
                  )}
                >
                  {/* Detail Modal Content */}
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-16 h-16 rounded-xl flex items-center justify-center",
                          theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/10"
                        )}>
                          {React.createElement(getTypeIcon(selectedDocument.type), {
                            className: cn(
                              "w-8 h-8",
                              theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                            )
                          })}
                        </div>
                        <div>
                          <h2 className={cn(
                            "text-2xl font-bold",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            {selectedDocument.name}
                          </h2>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              selectedDocument.status === 'active' ? "bg-green-500" :
                              selectedDocument.status === 'approved' ? "bg-blue-500" :
                              selectedDocument.status === 'pending' ? "bg-yellow-500" : "bg-red-500"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              {DOCUMENT_STATUS.find(s => s.id === selectedDocument.status)?.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedDocument(null)}
                        className={cn(
                          "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        )}
                      >
                        <X className={cn(
                          "w-5 h-5",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )} />
                      </button>
                    </div>

                    {/* Description */}
                    <div>
                      <h3 className={cn(
                        "text-lg font-semibold mb-2",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Descripción
                      </h3>
                      <p className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        {selectedDocument.description}
                      </p>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* File Information */}
                      <div className="space-y-4">
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Información del Archivo
                        </h3>

                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Tipo:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {DOCUMENT_TYPES.find(t => t.id === selectedDocument.type)?.name}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Categoría:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {DOCUMENT_CATEGORIES.find(c => c.id === selectedDocument.category)?.name}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Tamaño:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {selectedDocument.size}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Subido por:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {selectedDocument.uploadedBy}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Fecha de subida:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formatDate(selectedDocument.uploadDate)}
                            </span>
                          </div>

                          {selectedDocument.expiryDate && (
                            <div className="flex justify-between">
                              <span className={cn(
                                "text-sm",
                                theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )}>
                                Fecha de expiración:
                              </span>
                              <span className={cn(
                                "text-sm font-medium",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>
                                {formatDate(selectedDocument.expiryDate)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-4">
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Acciones
                        </h3>

                        <div className="flex gap-4">
                          <button
                            className={cn(
                              "flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300",
                              theme === 'dark' ? "bg-exa-secondary text-white hover:bg-exa-secondary/90" : "bg-exa-primary text-white hover:bg-exa-primary/90"
                            )}
                          >
                            <Download className="w-5 h-5" />
                            Descargar
                          </button>
                          <button
                            className={cn(
                              "flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300",
                              theme === 'dark' ? "border-gray-700 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            <Eye className="w-5 h-5" />
                            Vista Previa
                          </button>
                          <button
                            className={cn(
                              "flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300",
                              theme === 'dark' ? "border-gray-700 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            <Upload className="w-5 h-5" />
                            Actualizar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <h3 className={cn(
                      "text-lg font-semibold mb-4",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      Etiquetas
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedDocument.tags.map((tag, index) => (
                        <span
                          key={index}
                          className={cn(
                            "px-3 py-2 rounded-xl border flex items-center gap-2",
                            theme === 'dark' ? "border-gray-700" : "border-gray-200"
                          )}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/10"
                          )} />
                          <span className={cn(
                            "font-medium text-sm",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            {tag}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

          {/* Upload Modal */}
          <AnimatePresence>
            {showUploadModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setShowUploadModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6",
                    theme === 'dark' ? "bg-gray-900" : "bg-white"
                  )}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className={cn(
                      "text-xl font-bold",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      Subir Documento
                    </h2>
                    <button
                      onClick={() => setShowUploadModal(false)}
                      className={cn(
                        "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      )}
                    >
                      <X className={cn(
                        "w-5 h-5",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Nombre del documento *
                      </label>
                      <input
                        type="text"
                        placeholder="Ingresa el nombre del documento"
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Descripción
                      </label>
                      <textarea
                        placeholder="Describe el documento"
                        rows={4}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300 resize-none",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Tipo de documento
                        </label>
                        <select
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                            theme === 'dark'
                              ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                          )}
                        >
                          <option value="">Selecciona un tipo</option>
                          {DOCUMENT_TYPES.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Categoría
                        </label>
                        <select
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                            theme === 'dark'
                              ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                          )}
                        >
                          <option value="">Selecciona una categoría</option>
                          {DOCUMENT_CATEGORIES.map(category => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Seleccionar archivo
                      </label>
                      <div className={cn(
                        "w-full px-4 py-12 border-2 border-dashed rounded-xl text-center hover:border-exa-primary/50 transition-colors cursor-pointer",
                        theme === 'dark' ? "border-gray-700 hover:border-exa-secondary/50" : "border-gray-300 hover:border-exa-primary/50"
                      )}>
                        <Upload className={cn(
                          "w-12 h-12 mx-auto mb-2",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )} />
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Arrastra y suelta o haz clic para seleccionar
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 justify-end pt-4">
                      <button
                        onClick={() => setShowUploadModal(false)}
                        className={cn(
                          "px-6 py-3 rounded-xl font-medium transition-all duration-300",
                          theme === 'dark' ? "border-gray-700 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        Cancelar
                      </button>
                      <button
                        className={cn(
                          "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                          theme === 'dark' ? "bg-exa-secondary text-white hover:bg-exa-secondary/90" : "bg-exa-primary text-white hover:bg-exa-primary/90"
                        )}
                      >
                        <Check className="w-5 h-5" />
                        Subir Documento
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}