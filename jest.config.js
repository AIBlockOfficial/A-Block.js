module.exports = {
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(t|j)s$',
  "moduleDirectories": [
    "node_modules",
    "./src"
  ],
  moduleNameMapper: {
    "axios": "axios/dist/node/axios.cjs"
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};
