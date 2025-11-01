import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { X, Plus } from 'lucide-react'

interface DepartmentPillProps {
  departments: string[]
  onDepartmentsChange: (departments: string[]) => void
  className?: string
  disabled?: boolean
  placeholder?: string
}

const AVAILABLE_DEPARTMENTS = [
  'Remesas Familiares',
  'Recargas Telefónicas',
  'Paquetería',
  'Mercado'
]

export const DepartmentPill: React.FC<DepartmentPillProps> = ({
  departments,
  onDepartmentsChange,
  className,
  disabled = false,
  placeholder = "Seleccionar departamentos..."
}) => {
  const { theme } = useTheme()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const toggleDepartment = (department: string) => {
    if (departments.includes(department)) {
      onDepartmentsChange(departments.filter(d => d !== department))
    } else {
      onDepartmentsChange([...departments, department])
    }
  }

  const removeDepartment = (department: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!disabled) {
      onDepartmentsChange(departments.filter(d => d !== department))
    }
  }

  const toggleDropdown = () => {
    if (!disabled) {
      setIsDropdownOpen(!isDropdownOpen)
    }
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* Pills Container */}
      <div
        onClick={toggleDropdown}
        className={cn(
          "min-h-[48px] p-3 border rounded-xl cursor-text transition-all-300",
          "focus-within:ring-2 focus-within:ring-blue-500",
          theme === 'dark'
            ? "bg-gray-700 border-gray-600 text-white"
            : "bg-white border-gray-300 text-gray-900",
          disabled && "opacity-50 cursor-not-allowed",
          isDropdownOpen && "ring-2 ring-blue-500"
        )}
      >
        <div className="flex flex-wrap gap-2 items-center">
          {departments.length === 0 ? (
            <span className={cn(
              "text-sm",
              theme === 'dark' ? "text-gray-400" : "text-gray-500"
            )}>
              {placeholder}
            </span>
          ) : (
            departments.map((department, index) => (
              <div
                key={index}
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium",
                  theme === 'dark'
                    ? "bg-blue-900 text-blue-200 border border-blue-700"
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                )}
              >
                {department}
                {!disabled && (
                  <button
                    onClick={(e) => removeDepartment(department, e)}
                    className={cn(
                      "ml-1 hover:text-red-500 transition-colors",
                      theme === 'dark' ? "hover:text-red-400" : "hover:text-red-600"
                    )}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}

          {/* Dropdown Arrow */}
          {!disabled && (
            <div className="ml-auto">
              <Plus className={cn(
                "w-4 h-4 transition-transform",
                theme === 'dark' ? "text-gray-400" : "text-gray-500",
                isDropdownOpen && "rotate-45"
              )} />
            </div>
          )}
        </div>
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && !disabled && (
        <div className={cn(
          "absolute z-10 w-full mt-1 border rounded-xl shadow-lg max-h-60 overflow-y-auto",
          theme === 'dark'
            ? "bg-gray-800 border-gray-600"
            : "bg-white border-gray-200"
        )}>
          {AVAILABLE_DEPARTMENTS.map((department) => {
            const isSelected = departments.includes(department)
            return (
              <div
                key={department}
                onClick={() => {
                  toggleDepartment(department)
                }}
                className={cn(
                  "px-4 py-3 cursor-pointer transition-colors flex items-center justify-between",
                  theme === 'dark'
                    ? "hover:bg-gray-700 text-white"
                    : "hover:bg-gray-50 text-gray-900",
                  isSelected && (
                    theme === 'dark'
                      ? "bg-blue-900 text-blue-200"
                      : "bg-blue-50 text-blue-800"
                  )
                )}
              >
                <span className="text-sm font-medium">{department}</span>
                {isSelected && (
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    theme === 'dark' ? "bg-blue-400" : "bg-blue-600"
                  )} />
                )}
              </div>
            )
          })}

          {AVAILABLE_DEPARTMENTS.length === 0 && (
            <div className={cn(
              "px-4 py-3 text-sm text-center",
              theme === 'dark' ? "text-gray-400" : "text-gray-500"
            )}>
              No hay departamentos disponibles
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  )
}

export default DepartmentPill