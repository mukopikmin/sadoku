import {
  createToaster,
  Portal,
  Stack,
  Toast,
  Toaster as ChakraToaster,
} from "@chakra-ui/react";

export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
});

export const Toaster = () => (
  <Portal>
    <ChakraToaster toaster={toaster} insetInline={{ md: "4" }}>
      {(toast) => (
        <Toast.Root width={{ md: "sm" }}>
          <Toast.Indicator />
          <Stack gap="1" flex="1" maxW="100%">
            {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
            {toast.description && (
              <Toast.Description>{toast.description}</Toast.Description>
            )}
          </Stack>
          {toast.action && (
            <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
          )}
          {toast.closable && (
            <Toast.CloseTrigger aria-label="Close notification">
              ×
            </Toast.CloseTrigger>
          )}
        </Toast.Root>
      )}
    </ChakraToaster>
  </Portal>
);
