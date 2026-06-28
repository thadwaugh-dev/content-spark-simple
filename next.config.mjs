import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = fs.realpathSync.native(path.dirname(fileURLToPath(import.meta.url)));
const projectRootLower = projectRoot.toLowerCase();

function normalizeToProjectRoot(filePath) {
  if (typeof filePath !== 'string') return filePath;

  const resolved = path.resolve(filePath);
  const resolvedLower = resolved.toLowerCase();

  if (resolvedLower.startsWith(projectRootLower)) {
    return projectRoot + resolved.slice(projectRootLower.length);
  }

  return resolved;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
  webpack: (config) => {
    config.context = projectRoot;
    config.resolve.symlinks = false;

    config.plugins.push({
      apply(compiler) {
        compiler.hooks.normalModuleFactory.tap('NormalizeProjectPaths', (nmf) => {
          nmf.hooks.afterResolve.tap('NormalizeProjectPaths', (resolveData) => {
            if (resolveData.context) {
              resolveData.context = normalizeToProjectRoot(resolveData.context);
            }
            if (resolveData.resource) {
              resolveData.resource = normalizeToProjectRoot(resolveData.resource);
            }
          });
        });
      },
    });

    return config;
  },
};

export default nextConfig;