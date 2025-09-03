/**
 * Docker Hub and container registry specific configurations
 * Based on good-worker.js logic
 */

/**
 * Docker Hub base URL
 */
export const DOCKER_HUB_URL = 'https://registry-1.docker.io';

/**
 * Container registry routes mapping
 * Maps subdomain patterns to their upstream URLs
 */
export const DOCKER_ROUTES = {
  'docker-hub': DOCKER_HUB_URL,
  'docker': DOCKER_HUB_URL,
  'quay': 'https://quay.io',
  'gcr': 'https://gcr.io',
  'k8s-gcr': 'https://k8s.gcr.io',
  'k8s': 'https://registry.k8s.io',
  'ghcr': 'https://ghcr.io',
  'cloudsmith': 'https://docker.cloudsmith.io',
  'ecr': 'https://public.ecr.aws',
  'docker-staging': DOCKER_HUB_URL
};

/**
 * Check if a platform is Docker Hub
 * @param {string} platformUrl - The platform URL to check
 * @returns {boolean} True if the platform is Docker Hub
 */
export function isDockerHub(platformUrl) {
  return platformUrl === DOCKER_HUB_URL;
}

/**
 * Check if a platform is a container registry
 * @param {string} platformKey - The platform key to check
 * @returns {boolean} True if the platform is a container registry
 */
export function isContainerRegistry(platformKey) {
  return platformKey.startsWith('cr-') || 
         platformKey === 'docker-hub' || 
         platformKey === 'docker' ||
         Object.keys(DOCKER_ROUTES).includes(platformKey);
}

/**
 * Get the upstream URL for a Docker route
 * @param {string} hostname - The hostname to route
 * @returns {string} The upstream URL or empty string if not found
 */
export function routeByHosts(hostname) {
  if (hostname in DOCKER_ROUTES) {
    return DOCKER_ROUTES[hostname];
  }
  return '';
}

/**
 * Parse Docker WWW-Authenticate header
 * @param {string} authenticateStr - The WWW-Authenticate header value
 * @returns {{realm: string, service: string}} Parsed authentication info
 */
export function parseAuthenticate(authenticateStr) {
  // sample: Bearer realm="https://auth.ipv6.docker.com/token",service="registry.docker.io"
  // match strings after =" and before "
  const re = /(?<=\=")(?:\\.|[^"\\])*(?=")/g;
  const matches = authenticateStr.match(re);

  if (matches == null || matches.length < 2) {
    throw new Error(`invalid Www-Authenticate Header: ${authenticateStr}`);
  }

  return { realm: matches[0], service: matches[1] };
}

/**
 * Fetch authentication token from container registry
 * @param {{realm: string, service: string}} wwwAuthenticate - Authentication info
 * @param {string} scope - The scope for the token
 * @param {string} authorization - Authorization header value
 * @returns {Promise<Response>} Token response
 */
export async function fetchToken(wwwAuthenticate, scope, authorization) {
  const url = new URL(wwwAuthenticate.realm);
  if (wwwAuthenticate.service.length) {
    url.searchParams.set('service', wwwAuthenticate.service);
  }

  if (scope) {
    url.searchParams.set('scope', scope);
  }

  const headers = new Headers();
  if (authorization) {
    headers.set('Authorization', authorization);
  }

  return await fetch(url, { method: 'GET', headers: headers });
}

/**
 * Create unauthorized response for container registry
 * @param {URL} url - Request URL
 * @returns {Response} Unauthorized response
 */
export function responseUnauthorized(url) {
  const headers = new Headers();
  headers.set('WWW-Authenticate', `Bearer realm="https://${url.hostname}/v2/auth",service="Xget"`);
  return new Response(JSON.stringify({ message: 'UNAUTHORIZED' }), {
    status: 401,
    headers: headers
  });
}

/**
 * Handle Docker Hub library image scope completion
 * @param {string} scope - The original scope
 * @returns {string} The completed scope with library prefix if needed
 */
export function completeDockerHubScope(scope) {
  if (!scope) return scope;
  
  // autocomplete repo part into scope for DockerHub library images
  // Example: repository:busybox:pull => repository:library/busybox:pull
  let scopeParts = scope.split(':');
  if (scopeParts.length == 3 && !scopeParts[1].includes('/')) {
    scopeParts[1] = 'library/' + scopeParts[1];
    scope = scopeParts.join(':');
  }
  
  return scope;
}

/**
 * Handle Docker Hub library image path redirect
 * @param {string} pathname - The request pathname
 * @returns {string|null} The redirect path or null if no redirect needed
 */
export function handleDockerHubLibraryRedirect(pathname) {
  // redirect for DockerHub library images
  // Example: /v2/busybox/manifests/latest => /v2/library/busybox/manifests/latest
  const pathParts = pathname.split('/');
  if (pathParts.length == 5) {
    pathParts.splice(2, 0, 'library');
    return pathParts.join('/');
  }
  return null;
}
