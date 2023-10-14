import React, { memo, useEffect, useState } from 'react';
import classnames from 'classnames';
import { connect } from 'umi';
import lodash from 'lodash';
import Iconfont from '@/components/Iconfont';
import { IConnectionModelType } from '@/models/connection';
import { IWorkspaceModelType } from '@/models/workspace';
import { IMainPageType } from '@/models/mainPage';
import { Cascader, Spin, Modal, Button, Tag } from 'antd';
import { databaseMap, TreeNodeType } from '@/constants';
import { treeConfig } from '../Tree/treeConfig';
import { useUpdateEffect } from '@/hooks/useUpdateEffect';
import styles from './index.less';

interface IProps {
  className?: string;
  connectionModel: IConnectionModelType['state'];
  workspaceModel: IWorkspaceModelType['state'];
  mainPageModel: IMainPageType['state'];
  dispatch: any;
}

interface IOption {
  label: string | React.ReactNode;
  value: number | string;
}

const WorkspaceHeader = memo<IProps>((props) => {
  const { connectionModel, workspaceModel, mainPageModel, dispatch } = props;
  const { connectionList, curConnection } = connectionModel;
  const { curWorkspaceParams } = workspaceModel;
  const { curPage } = mainPageModel;
  const [cascaderLoading, setCascaderLoading] = useState(false);
  const [noConnectionModal, setNoConnectionModal] = useState(false);
  const [connectionOptions, setConnectionOptions] = useState<IOption[]>([]);
  const [curDBOptions, setCurDBOptions] = useState<IOption[]>([]);
  const [curSchemaOptions, setCurSchemaOptions] = useState<IOption[]>([]);
  const [isRefresh, setIsRefresh] = useState(false);

  useEffect(() => {
    if (curPage !== 'workspace') {
      return;
    }
    // 如果没有curConnection默认选第一个
    if (!curConnection?.id && connectionList.length) {
      connectionChange([connectionList[0].id], [connectionList[0]]);
      return;
    }
    // 如果都有的话
    if (curConnection?.id && connectionList.length) {
      // 如果curConnection不再connectionList里，也是默认选第一个
      const flag = connectionList.findIndex((t: any) => t.id === curConnection?.id);
      if (flag === -1) {
        connectionChange([connectionList[0].id], [connectionList[0]]);
        return;
      }

      // 如果切换了curConnection 导致curWorkspaceParams与curConnection不同
      if (curWorkspaceParams.dataSourceId !== curConnection?.id) {
        setCurWorkspaceParams({
          dataSourceId: curConnection.id,
          dataSourceName: curConnection.alias,
          databaseType: curConnection.type,
        });
        setCurDBOptions([]);
        setCurSchemaOptions([]);
      }

      // 获取database列表
      getDatabaseList(isRefresh);
      setIsRefresh(false);
    }
    // connectionList转换成可用的ConnectionOptions
    setConnectionOptions(
      connectionList?.map((t) => {
        return {
          value: t.id,
          label: (
            <div style={{ display: 'flex' }}>
              <Iconfont className={styles.databaseTypeIcon} code={databaseMap[t.type]?.icon} />
              <div className={styles.text}>{t.alias}</div>
            </div>
          ),
        };
      }),
    );
  }, [connectionList, curConnection, curPage]);

  useUpdateEffect(() => {
    if (!connectionList.length) {
      dispatch({
        type: 'workspace/setCurWorkspaceParams',
        payload: {},
      });
      dispatch({
        type: 'connection/setCurConnection',
        payload: {},
      });
    }
  }, [connectionList]);

  function getDatabaseList(refresh = false) {
    setCascaderLoading(true);
    if (!curConnection?.id) {
      return;
    }
    treeConfig[TreeNodeType.DATA_SOURCE]
      .getChildren?.({
        dataSourceId: curConnection.id,
        refresh,
        extraParams: {
          databaseType: curConnection.type,
          dataSourceId: curConnection.id,
          dataSourceName: curConnection.name,
        },
      })
      .then((res) => {
        const dbList =
          res?.map((t) => {
            return {
              value: t.key,
              label: t.name,
            };
          }) || [];
        setCurDBOptions(dbList);
        // 如果是切换那么就默认取列表的第一个database， 如果不是切换那么就取缓存的，如果缓存没有还是取列表第一个（这里是兜底，如果原先他并没有database，后来他加了database，如果还是取缓存的空就不对了）
        const databaseName =
          curWorkspaceParams.dataSourceId !== curConnection?.id
            ? dbList[0]?.label
            : curWorkspaceParams.databaseName || dbList[0]?.label;
        getSchemaList(databaseName, refresh);
      })
      .catch((error) => {
        setCascaderLoading(false);
      });
  }

  function getSchemaList(databaseName: string | null | undefined, refresh = false) {
    if (!curConnection?.id) {
      return;
    }
    treeConfig[TreeNodeType.DATABASE]
      .getChildren?.({
        dataSourceId: curConnection.id,
        databaseName: databaseName,
        refresh,
        extraParams: {
          databaseName: databaseName,
          databaseType: curConnection.type,
          dataSourceId: curConnection.id,
          dataSourceName: curConnection.name,
        },
      })
      .then((res) => {
        const schemaList =
          res?.map((t) => {
            return {
              value: t.key,
              label: t.name,
            };
          }) || [];
        setCurSchemaOptions(schemaList);
        const schemaName =
          curWorkspaceParams.dataSourceId !== curConnection?.id
            ? schemaList[0]?.label
            : curWorkspaceParams.schemaName || schemaList[0]?.label;
        const data: any = {
          dataSourceId: curConnection.id,
          dataSourceName: curConnection.alias,
          databaseType: curConnection.type,
          databaseName: databaseName || null,
          schemaName: schemaName || null,
        };

        setCurWorkspaceParams(data);
      })
      .catch(() => {
        setCurWorkspaceParams({
          dataSourceId: curConnection.id,
          dataSourceName: curConnection.alias,
          databaseType: curConnection.type,
          databaseName: databaseName || null,
        });
      })
      .finally(() => {
        setCascaderLoading(false);
      });
  }

  function setCurWorkspaceParams(payload: IWorkspaceModelType['state']['curWorkspaceParams']) {
    if (lodash.isEqual(curWorkspaceParams, payload)) {
      return;
    }

    dispatch({
      type: 'workspace/setCurWorkspaceParams',
      payload,
    });
  }

  const getConnectionList = () => {
    setCascaderLoading(true);
    setIsRefresh(true);
    dispatch({
      type: 'connection/fetchConnectionList',
      payload: {
        refresh: true,
      },
    });
  };

  // 连接切换
  function connectionChange(id: any) {
    connectionList.map((t) => {
      if (t.id === id[0] && curWorkspaceParams.dataSourceId !== id[0]) {
        dispatch({
          type: 'connection/setCurConnection',
          payload: t,
        });
      }
    });
  }

  // 数据库切换
  function databaseChange(valueArr: any, selectedOptions: any) {
    if (selectedOptions[0].label !== curWorkspaceParams.databaseName) {
      getSchemaList(selectedOptions[0].label);
    }
  }

  // schema切换
  function schemaChange(valueArr: any, selectedOptions: any) {
    if (selectedOptions[0].label !== curWorkspaceParams.schemaName) {
      setCurWorkspaceParams({ ...curWorkspaceParams, schemaName: selectedOptions[0].value });
    }
  }

  function handleRefresh() {
    getConnectionList();
  }

  return (
    <>
      {!!connectionList.length && (
        <div className={styles.workspaceHeader}>
          <div className={styles.workspaceHeaderLeft}>
            <Cascader
              popupClassName={styles.cascaderPopup}
              options={connectionOptions}
              onChange={connectionChange}
              bordered={false}
              value={[curConnection?.id || '']}
            >
              <div className={styles.crumbsItem}>
                <Iconfont
                  className={styles.databaseTypeIcon}
                  code={databaseMap[curWorkspaceParams.databaseType]?.icon}
                />
                <div className={styles.text}>{curWorkspaceParams.dataSourceName}</div>
              </div>
            </Cascader>

            {!!curDBOptions?.length && <Iconfont className={styles.arrow} code="&#xe641;" />}

            {!!curDBOptions?.length && (
              <Cascader
                popupClassName={styles.cascaderPopup}
                options={curDBOptions}
                onChange={databaseChange}
                bordered={false}
                value={[curWorkspaceParams?.databaseName || '']}
              >
                <div className={styles.crumbsItem}>
                  <div className={styles.text}>{curWorkspaceParams.databaseName}</div>
                </div>
              </Cascader>
            )}
            {!!curSchemaOptions.length && <Iconfont className={styles.arrow} code="&#xe641;" />}
            {!!curSchemaOptions.length && (
              <Cascader
                popupClassName={styles.cascaderPopup}
                options={curSchemaOptions}
                onChange={schemaChange}
                bordered={false}
                value={[curWorkspaceParams?.schemaName || '']}
              >
                <div className={styles.crumbsItem}>
                  <div className={styles.text}>{curWorkspaceParams.schemaName}</div>
                </div>
              </Cascader>
            )}
            <div className={styles.refreshBox} onClick={handleRefresh}>
              {cascaderLoading ? (
                <Spin className={styles.spin} />
              ) : (
                <Iconfont className={styles.typeIcon} code="&#xec08;" />
              )}
            </div>
          </div>
          <div className={classnames(styles.connectionTag, styles.workspaceHeaderCenter)}>
            {curConnection?.id && curConnection?.environment?.shortName && (
              <Tag color={curConnection?.environment?.color?.toLocaleLowerCase()}>
                {curConnection?.environment?.shortName}
              </Tag>
            )}
          </div>
          <div className={styles.workspaceHeaderRight} />
        </div>
      )}

      <Modal
        open={noConnectionModal}
        closeIcon={<></>}
        keyboard={false}
        maskClosable={false}
        title="温馨提示"
        footer={[]}
      >
        <div className={styles.noConnectionModal}>
          <div className={styles.mainText}>您当前还没有创建任何连接</div>
          <Button
            type="primary"
            className={styles.createButton}
            onClick={() => {
              setNoConnectionModal(false);
              dispatch({
                type: 'mainPage/updateCurPage',
                payload: 'connections',
              });
            }}
          >
            创建连接
          </Button>
        </div>
      </Modal>
    </>
  );
});

export default connect(
  ({
    connection,
    workspace,
    mainPage,
  }: {
    connection: IConnectionModelType;
    workspace: IWorkspaceModelType;
    mainPage: IMainPageType;
  }) => ({
    connectionModel: connection,
    workspaceModel: workspace,
    mainPageModel: mainPage,
  }),
)(WorkspaceHeader);
