import React from 'react';

export const Chatbot = () => {
    return (
        <div className="flex flex-col h-full bg-gray-50 border-l border-gray-200">
            <div className="flex-shrink-0 p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Chatbot</h2>
            </div>
            <div className="flex-grow p-4 overflow-y-auto">
                {/* Chat messages will go here */}
            </div>
            <div className="p-4 border-t border-gray-200">
                <input
                    type="text"
                    placeholder="Type a message..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
    );
};
