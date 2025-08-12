module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f6fbff',
          100: '#e6f2ff',
          300: '#80bfff',
          500: '#0077ff', // primary
          700: '#005ad1'
        },
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          300: '#d1d5db',
          700: '#374151'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(2,6,23,0.08)',
      },
      borderRadius: { xl: '1rem' }
    }
  },
  plugins: []
};
