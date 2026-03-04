import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'PromptCanary',
  description: 'Test your prompts like you test your code. Catch model drift before your users do.',

  base: '/promptcanary/',

  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/promptcanary/logo.svg' }]],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Reference', link: '/configuration' },
      { text: 'API', link: '/api' },
      {
        text: 'v1.0.0',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'npm', link: 'https://www.npmjs.com/package/promptcanary' },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is PromptCanary?', link: '/what-is-promptcanary' },
          { text: 'Getting Started', link: '/getting-started' },
        ],
      },
      {
        text: 'Guide',
        items: [
          { text: 'Providers', link: '/providers' },
          { text: 'Assertions & Expectations', link: '/assertions' },
          { text: 'CI/CD Integration', link: '/ci-cd' },
          { text: 'Comparison', link: '/comparison' },
          { text: 'Configuration (YAML)', link: '/configuration' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API Reference', link: '/api' },
          { text: 'CLI Commands', link: '/cli' },
          { text: 'Configuration Schema', link: '/configuration-schema' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'Troubleshooting', link: '/troubleshooting' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/VebjornNyvoll/promptcanary' }],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Vebjørn Nyvoll',
    },

    editLink: {
      pattern: 'https://github.com/VebjornNyvoll/promptcanary/edit/master/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
