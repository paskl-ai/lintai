import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAppSelector } from '../../redux/services/store';

export default function ConfigurationInfo() {
  const navigate = useNavigate();
  const configValues = useAppSelector((state) => state.config);
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const handleNavigateToConfig = () => navigate('/configuration');

  return (
    // Make this container relative so the absolute dropdown is positioned correctly
    <div className="w-full max-w-md mx-auto  bg-white border border-gray-200 relative z-50">
      {/* HEADER */}
      <button
        onClick={toggleOpen}
        className="w-full flex  justify-between items-center px-4 py-2 focus:outline-none"
        aria-expanded={isOpen}
      >
        <span className="text-md font-medium text-gray-800">Configuration</span>
        <svg
          className={` w-5 text-gray-600 transform transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* COLLAPSIBLE CONTENT (absolute, so it won’t push parent height) */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white  border-gray-200 shadow-md rounded-b-lg">
          {/* JSON container */}
          <div className="max-h-60 overflow-auto bg-gray-50 p-2 rounded-t-lg">
            {/* 
              - whitespace-pre preserves formatting 
              - overflow-x-auto lets it scroll sideways if needed
            */}
            <pre className="whitespace-pre text-sm text-gray-700 overflow-x-auto">
              {JSON.stringify(configValues, null, 2)}
            </pre>
          </div>

          {/* “Go to Configuration” button */}
          <button
            onClick={handleNavigateToConfig}
            className="w-full px-3 py-2 bg-blue-600 text-white text-center rounded-b-lg hover:bg-blue-700 transition-colors"
          >
            Go to Configuration
          </button>
        </div>
      )}
    </div>
  );
}
