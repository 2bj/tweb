import Badge from '@components/badge';
import Tabs from '@components/tabs';
import wrapFolderTitle from '@components/wrappers/folderTitle';
import {
  applyFolderItemAccessibility,
  applyFoldersNavigationLandmark,
  handleFolderItemKeydown
} from '@helpers/accessibility';
import {simulateClickEvent} from '@helpers/dom/clickEvent';
import documentFragmentToNodes from '@helpers/dom/documentFragmentToNodes';
import createMiddleware from '@helpers/solid/createMiddleware';
import {FOLDER_ID_ALL} from '@lib/appManagers/constants';
import I18n, {i18n} from '@lib/langPack';
import useFolders from '@stores/folders';
import {createEffect, For} from 'solid-js';

export default function FoldersTabs(props: {
  scrollableProps?: Partial<Parameters<typeof Tabs.MenuScrollable>[0]>,
  menuProps?: Partial<Parameters<typeof Tabs.Menu>[0]>,
  gradientProps?: Parameters<typeof Tabs.MenuGradient>[0]
}) {
  const {folderItems, selectedFolderId} = useFolders();

  const applyMenuRef = (el: HTMLDivElement) => {
    const userRef = props.menuProps?.ref;
    if(typeof userRef === 'function') {
      userRef(el);
    }

    applyFoldersNavigationLandmark(el);
  };

  const Tab = (item: typeof folderItems[0]) => {
    let tabEl: HTMLDivElement;

    const title = () => {
      if(item.id === FOLDER_ID_ALL) {
        return i18n('FilterAllChatsShort');
      }

      const fragment = wrapFolderTitle(
        item.filter.title,
        createMiddleware().get(),
        true,
        {textColor: 'secondary-text-color'}
      );
      return documentFragmentToNodes(fragment);
    };

    const plainTitle = () => item.id === FOLDER_ID_ALL ?
      I18n.format('FilterAllChatsShort', true) :
      (item.filter.title?.text || '').trim();

    createEffect(() => {
      if(!tabEl) {
        return;
      }

      applyFolderItemAccessibility(tabEl, {
        title: plainTitle(),
        unreadCount: item.notifications?.count,
        isMuted: !!item.notifications?.muted,
        selected: selectedFolderId() === item.id
      });
    });

    return (
      <Tabs.MenuTab
        ref={(ref) => {
          tabEl = ref;
          ref.dataset.filterId = '' + item.filter.id;
          ref.onkeydown = (event) => handleFolderItemKeydown(event, () => simulateClickEvent(ref));
        }}
      >
        <span class="text-super">
          {title()}
        </span>
        <Badge
          tag="div"
          size={20}
          color={item.notifications.muted ? 'gray' : 'primary'}
        >
          {item.notifications.count}
        </Badge>
      </Tabs.MenuTab>
    );
  };

  return (
    <Tabs>
      {props.gradientProps && <Tabs.MenuGradient {...props.gradientProps} />}
      <Tabs.MenuScrollable {...(props.scrollableProps || {})}>
        <Tabs.Menu {...(props.menuProps || {})} ref={applyMenuRef}>
          <For each={folderItems}>{Tab}</For>
        </Tabs.Menu>
      </Tabs.MenuScrollable>
    </Tabs>
  );
}
