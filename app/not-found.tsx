// app/not-found.tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-black text-white">
      {/* Floating background shapes */}
      <motion.div
        className="absolute top-10 left-10 w-40 h-40 bg-blue-500 rounded-full mix-blend-screen blur-3xl opacity-30"
        animate={{ x: [0, 30, -30, 0], y: [0, -30, 30, 0] }}
        transition={{ repeat: Infinity, duration: 10 }}
      />
      <motion.div
        className="absolute bottom-10 right-10 w-60 h-60 bg-purple-600 rounded-full mix-blend-screen blur-3xl opacity-30"
        animate={{ x: [0, -40, 40, 0], y: [0, 40, -40, 0] }}
        transition={{ repeat: Infinity, duration: 12 }}
      />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 flex flex-col items-center justify-center bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-10 text-center max-w-lg"
      >
        <h1 className="text-8xl font-extrabold tracking-widest text-blue-400 drop-shadow-lg">
          404
        </h1>
        <p className="mt-4 text-2xl font-semibold">Oops! Page Not Found</p>
        <p className="mt-2 text-gray-300">
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:scale-105 transition-transform"
        >
          Go Back Home
        </Link>
      </motion.div>
    </div>
  );
}
