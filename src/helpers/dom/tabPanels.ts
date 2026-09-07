import whichChild from '@helpers/dom/whichChild';

export function getTabPanelSiblings(content: HTMLElement) {
  const tabs = content.querySelectorAll(':scope > .tabs-tab');
  return tabs.length ? tabs : content.children;
}

export function getTabPanelByIndex(content: HTMLElement, index: number) {
  return getTabPanelSiblings(content)[index] as HTMLElement;
}

export function getTabPanelIndex(content: HTMLElement, element: HTMLElement) {
  const panels = getTabPanelSiblings(content);
  const index = Array.prototype.indexOf.call(panels, element);
  return index !== -1 ? index : whichChild(element);
}
