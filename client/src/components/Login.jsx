import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            console.log('Attempting login with:', formData); // Log the form data

            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            console.log('Login response:', data); // Log the response

            if (data.success) {
                navigate('/admin/stream');
            } else {
                alert(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
                <h2 className="text-2xl text-white mb-6 text-center">Admin Login</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-300 mb-2">Username</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({
                                ...formData,
                                username: e.target.value
                            })}
                            className="w-full p-2 rounded bg-gray-700 text-white"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-300 mb-2">Password</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({
                                ...formData,
                                password: e.target.value
                            })}
                            className="w-full p-2 rounded bg-gray-700 text-white"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login; 