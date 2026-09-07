import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

export const sadokuChakraSystem = createSystem(
  defaultConfig,
  defineConfig({
    globalCss: {
      body: {
        bg: "canvas",
        color: "fg",
        fontFamily: "body",
        fontSize: "md",
        lineHeight: "1.7",
        margin: 0,
      },
    },
    theme: {
      tokens: {
        fontSizes: {
          "2xs": { value: "calc(0.55rem * var(--sadoku-font-scale, 1))" },
          xs: { value: "calc(0.7rem * var(--sadoku-font-scale, 1))" },
          sm: { value: "calc(0.8rem * var(--sadoku-font-scale, 1))" },
          md: { value: "calc(1rem * var(--sadoku-font-scale, 1))" },
          lg: { value: "calc(1rem * var(--sadoku-font-scale, 1))" },
          xl: { value: "calc(1.1rem * var(--sadoku-font-scale, 1))" },
          "2xl": { value: "calc(1.35rem * var(--sadoku-font-scale, 1))" },
          "3xl": { value: "calc(1.65rem * var(--sadoku-font-scale, 1))" },
          "4xl": { value: "calc(2rem * var(--sadoku-font-scale, 1))" },
          "5xl": { value: "calc(2.7rem * var(--sadoku-font-scale, 1))" },
          "6xl": { value: "calc(3.4rem * var(--sadoku-font-scale, 1))" },
          "7xl": { value: "calc(4rem * var(--sadoku-font-scale, 1))" },
          "8xl": { value: "calc(5.4rem * var(--sadoku-font-scale, 1))" },
          "9xl": { value: "calc(7.2rem * var(--sadoku-font-scale, 1))" },
        },
        fonts: {
          body: {
            value:
              '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", "Noto Sans CJK JP", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
          },
          mono: {
            value:
              '"JetBrains Mono", "Fira Code", "Cascadia Code", "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, Monaco, "UDEV Gothic", "BIZ UDGothic", "Noto Sans Mono CJK JP", monospace',
          },
        },
      },
      semanticTokens: {
        colors: {
          accent: {
            value: { _dark: "{colors.blue.400}", base: "{colors.blue.600}" },
          },
          canvas: {
            DEFAULT: {
              value: { _dark: "{colors.gray.950}", base: "{colors.white}" },
            },
            subtle: {
              value: { _dark: "{colors.gray.900}", base: "{colors.gray.50}" },
            },
          },
          border: {
            default: {
              value: { _dark: "{colors.gray.700}", base: "{colors.gray.300}" },
            },
            muted: {
              value: { _dark: "{colors.gray.800}", base: "{colors.gray.200}" },
            },
          },
          code: {
            bg: {
              value: { _dark: "{colors.gray.800}", base: "{colors.gray.100}" },
            },
            fg: {
              value: { _dark: "{colors.blue.300}", base: "{colors.blue.900}" },
            },
          },
          fg: {
            DEFAULT: {
              value: { _dark: "{colors.gray.100}", base: "{colors.gray.950}" },
            },
            muted: {
              value: { _dark: "{colors.gray.400}", base: "{colors.gray.600}" },
            },
          },
          link: {
            value: { _dark: "{colors.blue.400}", base: "{colors.blue.600}" },
          },
          overlay: {
            backdrop: { value: "{colors.blackAlpha.600}" },
            shadow: { value: "{colors.blackAlpha.300}" },
          },
          selection: {
            comment: {
              value: {
                _dark: "{colors.yellow.400}",
                base: "{colors.yellow.600}",
              },
            },
          },
          syntax: {
            addition: {
              bg: {
                value: {
                  _dark: "{colors.green.950}",
                  base: "{colors.green.100}",
                },
              },
              fg: {
                value: {
                  _dark: "{colors.green.100}",
                  base: "{colors.green.800}",
                },
              },
            },
            attribute: {
              value: {
                _dark: "{colors.green.300}",
                base: "{colors.green.800}",
              },
            },
            comment: {
              value: { _dark: "{colors.gray.400}", base: "{colors.gray.600}" },
            },
            deletion: {
              bg: {
                value: { _dark: "{colors.red.950}", base: "{colors.red.100}" },
              },
              fg: {
                value: { _dark: "{colors.red.100}", base: "{colors.red.800}" },
              },
            },
            keyword: {
              value: { _dark: "{colors.red.400}", base: "{colors.red.800}" },
            },
            literal: {
              value: {
                _dark: "{colors.orange.300}",
                base: "{colors.orange.800}",
              },
            },
            meta: {
              value: {
                _dark: "{colors.blue.300}",
                base: "{colors.purple.800}",
              },
            },
            string: {
              value: { _dark: "{colors.blue.200}", base: "{colors.green.800}" },
            },
            type: {
              value: {
                _dark: "{colors.purple.300}",
                base: "{colors.blue.800}",
              },
            },
          },
          warning: {
            fg: {
              value: {
                _dark: "{colors.yellow.400}",
                base: "{colors.yellow.700}",
              },
            },
          },
        },
      },
    },
  }),
);
