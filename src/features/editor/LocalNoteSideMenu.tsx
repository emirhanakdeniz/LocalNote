import type { Block } from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  BlockPopover,
  SideMenu,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import { autoUpdate, offset, type ReferenceType } from "@floating-ui/react";
import { useCallback, useMemo } from "react";
import { getLocalNoteSideMenuOffset } from "./targetBlockResolver";

export function LocalNoteSideMenu() {
  const sideMenuState = useExtensionState(SideMenuExtension);
  const sideMenuExtension = useExtension(SideMenuExtension);

  const whileMounted = useCallback(
    (reference: ReferenceType, floating: HTMLElement) => {
      let isFirst = false;
      return autoUpdate(
        reference,
        floating,
        () => {
          if (!isFirst) {
            isFirst = true;
            return;
          }
          sideMenuExtension?.hideMenuIfNotFrozen();
        },
        {
          ancestorScroll: true,
          ancestorResize: false,
          elementResize: false,
          layoutShift: false,
        },
      );
    },
    [sideMenuExtension],
  );

  const block = sideMenuState?.block;
  const show = sideMenuState?.show;

  const floatingOptions = useMemo(
    () => ({
      useFloatingOptions: {
        open: show,
        placement: "left-start" as const,
        middleware: [
          offset({
            crossAxis: block ? getLocalNoteSideMenuOffset(block as Block) : 0,
          }),
        ],
        whileElementsMounted: whileMounted,
      },
      useDismissProps: { enabled: false },
      focusManagerProps: { disabled: true },
      elementProps: { style: { zIndex: 20 } },
    }),
    [show, block, whileMounted],
  );

  return (
    <BlockPopover
      blockId={show ? (block?.id as string | undefined) : undefined}
      {...floatingOptions}
    >
      {block?.id ? <SideMenu /> : null}
    </BlockPopover>
  );
}
