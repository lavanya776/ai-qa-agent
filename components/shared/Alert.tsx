
import React, { ReactNode } from 'react';
import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

type AlertType = 'info' | 'warning' | 'success' | 'error';

interface AlertProps {
  type: AlertType;
  title?: string;
  children: ReactNode;
  className?: string;
}

const Alert: React.FC<AlertProps> = ({ type, title, children, className = '' }) => {
  const baseClasses = "p-4 rounded-md border";
  const typeClasses = {
    info: "bg-sky-900 border-sky-700 text-sky-300",
    warning: "bg-yellow-900 border-yellow-700 text-yellow-300",
    success: "bg-green-900 border-green-700 text-green-300",
    error: "bg-red-900 border-red-700 text-red-300",
  };
  const Icon = {
    info: <Info className="text-sky-400" />,
    warning: <AlertTriangle className="text-yellow-400" />,
    success: <CheckCircle className="text-green-400" />,
    error: <XCircle className="text-red-400" />,
  }[type];

  return (
    <div className={`${baseClasses} ${typeClasses[type]} ${className} flex items-start space-x-3`} role="alert">
      <div className="flex-shrink-0 pt-0.5">{Icon}</div>
      <div className="flex-1">
        {title && <h3 className="text-lg font-medium mb-1">{title}</h3>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
};

export default Alert;
