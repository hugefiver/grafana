import * as H from 'history';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { locationUtil, NavModel, NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button, ToolbarButtonRow } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import { DashboardMetaChangedEvent } from 'app/types/events';

import { VariableEditorContainer } from '../../../variables/editor/VariableEditorContainer';
import { DashboardModel } from '../../state/DashboardModel';
import { AccessControlDashboardPermissions } from '../DashboardPermissions/AccessControlDashboardPermissions';
import { DashboardPermissions } from '../DashboardPermissions/DashboardPermissions';
import { SaveDashboardAsButton, SaveDashboardButton } from '../SaveDashboard/SaveDashboardButton';

import { AnnotationsSettings } from './AnnotationsSettings';
import { GeneralSettings } from './GeneralSettings';
import { JsonEditorSettings } from './JsonEditorSettings';
import { LinksSettings } from './LinksSettings';
import { VersionsSettings } from './VersionsSettings';
import { SettingsPage, SettingsPageProps } from './types';

export interface Props {
  dashboard: DashboardModel;
  sectionNav: NavModel;
  pageNav: NavModelItem;
  editview: string;
}

const onClose = () => locationService.partial({ editview: null, editIndex: null });

export function DashboardSettings({ dashboard, editview, pageNav, sectionNav }: Props) {
  const [updateId, setUpdateId] = useState(0);
  useEffect(() => {
    dashboard.events.subscribe(DashboardMetaChangedEvent, () => setUpdateId((v) => v + 1));
  }, [dashboard]);

  // updateId in deps so we can revaluate when dashboard is mutated
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pages = useMemo(() => getSettingsPages(dashboard), [dashboard, updateId]);

  const onPostSave = () => {
    dashboard.meta.hasUnsavedFolderChange = false;
  };

  const currentPage = pages.find((page) => page.id === editview) ?? pages[0];
  const canSaveAs = contextSrv.hasEditPermissionInFolders;
  const canSave = dashboard.meta.canSave;
  const location = useLocation();
  const editIndex = getEditIndex(location);
  const subSectionNav = getSectionNav(pageNav, sectionNav, pages, currentPage, location);
  const size = 'sm';

  const actions = [
    <Button
      data-testid={selectors.pages.Dashboard.Settings.Actions.close}
      variant="secondary"
      key="close"
      fill="outline"
      size={size}
      onClick={onClose}
    >
      Close
    </Button>,
    canSaveAs && (
      <SaveDashboardAsButton
        dashboard={dashboard}
        onSaveSuccess={onPostSave}
        variant="secondary"
        key="save as"
        size={size}
      />
    ),
    canSave && <SaveDashboardButton dashboard={dashboard} onSaveSuccess={onPostSave} key="Save" size={size} />,
  ];

  return (
    <>
      <AppChromeUpdate actions={<ToolbarButtonRow alignment="right">{actions}</ToolbarButtonRow>} />
      <currentPage.component sectionNav={subSectionNav} dashboard={dashboard} editIndex={editIndex} />
    </>
  );
}

function getSettingsPages(dashboard: DashboardModel) {
  const pages: SettingsPage[] = [];

  const generalTitle = t('dashboard-settings.general.title', 'General');

  if (dashboard.meta.canEdit) {
    pages.push({
      title: generalTitle,
      id: 'settings',
      icon: 'sliders-v-alt',
      component: GeneralSettings,
    });

    pages.push({
      title: t('dashboard-settings.annotations.title', 'Annotations'),
      id: 'annotations',
      icon: 'comment-alt',
      component: AnnotationsSettings,
      subTitle:
        'Annotation queries return events that can be visualized as event markers in graphs across the dashboard.',
    });

    pages.push({
      title: t('dashboard-settings.variables.title', 'Variables'),
      id: 'templating',
      icon: 'calculator-alt',
      component: VariableEditorContainer,
      subTitle: 'Variables can make your dashboard more dynamic and act as global filters.',
    });

    pages.push({
      title: t('dashboard-settings.links.title', 'Links'),
      id: 'links',
      icon: 'link',
      component: LinksSettings,
    });
  }

  if (dashboard.meta.canMakeEditable) {
    pages.push({
      title: generalTitle,
      icon: 'sliders-v-alt',
      id: 'settings',
      component: MakeEditable,
    });
  }

  if (dashboard.id && dashboard.meta.canSave) {
    pages.push({
      title: t('dashboard-settings.versions.title', 'Versions'),
      id: 'versions',
      icon: 'history',
      component: VersionsSettings,
    });
  }

  const permissionsTitle = t('dashboard-settings.permissions.title', 'Permissions');

  if (dashboard.id && dashboard.meta.canAdmin) {
    if (!config.rbacEnabled) {
      pages.push({
        title: permissionsTitle,
        id: 'permissions',
        icon: 'lock',
        component: DashboardPermissions,
      });
    } else if (contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsRead)) {
      pages.push({
        title: permissionsTitle,
        id: 'permissions',
        icon: 'lock',
        component: AccessControlDashboardPermissions,
      });
    }
  }

  pages.push({
    title: t('dashboard-settings.json-editor.title', 'JSON Model'),
    id: 'dashboard_json',
    icon: 'arrow',
    component: JsonEditorSettings,
  });

  return pages;
}

function applySectionAsParent(node: NavModelItem, parent: NavModelItem): NavModelItem {
  return {
    ...node,
    parentItem: node.parentItem ? applySectionAsParent(node.parentItem, parent) : parent,
  };
}

function getSectionNav(
  pageNav: NavModelItem,
  sectionNav: NavModel,
  pages: SettingsPage[],
  currentPage: SettingsPage,
  location: H.Location
): NavModel {
  const main: NavModelItem = {
    text: t('dashboard-settings.settings.title', 'Settings'),
    children: [],
    icon: 'apps',
    hideFromBreadcrumbs: true,
  };

  if (config.featureToggles.dockedMegaMenu) {
    main.hideFromBreadcrumbs = false;
    main.url = locationUtil.getUrlForPartial(location, { editview: 'settings', editIndex: null });
  }

  main.children = pages.map((page) => ({
    text: page.title,
    icon: page.icon,
    id: page.id,
    url: locationUtil.getUrlForPartial(location, { editview: page.id, editIndex: null }),
    active: page === currentPage,
    parentItem: main,
    subTitle: page.subTitle,
  }));

  const pageNavWithSectionParent = applySectionAsParent(pageNav, sectionNav.node);

  main.parentItem = pageNavWithSectionParent;

  return {
    main,
    node: main.children.find((x) => x.active)!,
  };
}

function MakeEditable({ dashboard, sectionNav }: SettingsPageProps) {
  return (
    <Page navModel={sectionNav}>
      <div className="dashboard-settings__header">Dashboard not editable</div>
      <Button type="submit" onClick={() => dashboard.makeEditable()}>
        Make editable
      </Button>
    </Page>
  );
}

function getEditIndex(location: H.Location): number | undefined {
  const editIndex = new URLSearchParams(location.search).get('editIndex');
  if (editIndex != null) {
    return parseInt(editIndex, 10);
  }
  return undefined;
}
