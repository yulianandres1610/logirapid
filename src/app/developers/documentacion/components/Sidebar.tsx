'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Circle } from 'lucide-react'

interface NavItem {
  id: string
  label: string
  children?: NavItem[]
  badge?: 'available' | 'coming_soon'
}

interface SidebarProps {
  items: NavItem[]
  activeSection: string
  onNavigate: (id: string) => void
}

export default function Sidebar({ items, activeSection, onNavigate }: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['auth', 'introduction'])

  const toggleSection = (id: string) => {
    setExpandedSections(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : [...prev, id]
    )
  }

  const handleClick = (item: NavItem) => {
    if (item.children && item.children.length > 0) {
      toggleSection(item.id)
    }
    onNavigate(item.id)
  }

  const renderItem = (item: NavItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedSections.includes(item.id)
    const isActive = activeSection === item.id

    return (
      <div key={item.id}>
        <button
          onClick={() => handleClick(item)}
          className={`
            w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors
            ${level > 0 ? 'ml-4' : ''}
            ${isActive
              ? 'bg-[#cc0a46]/20 text-[#cc0a46]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }
          `}
        >
          <div className="flex items-center gap-2">
            {level > 0 && (
              <Circle className={`h-1.5 w-1.5 ${isActive ? 'fill-[#cc0a46]' : 'fill-gray-600'}`} />
            )}
            <span>{item.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {item.badge && (
              <span className={`
                px-1.5 py-0.5 text-[10px] font-medium rounded
                ${item.badge === 'available'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-500'
                }
              `}>
                {item.badge === 'available' ? 'Disponible' : 'Proximamente'}
              </span>
            )}
            {hasChildren && (
              isExpanded
                ? <ChevronDown className="h-4 w-4 text-gray-500" />
                : <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </div>
        </button>

        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children!.map(child => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav className="space-y-1">
      {items.map(item => renderItem(item))}
    </nav>
  )
}
