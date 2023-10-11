package ai.chat2db.server.web.api.controller.ai;

import ai.chat2db.server.domain.api.param.ShowCreateTableParam;
import ai.chat2db.server.domain.api.param.TablePageQueryParam;
import ai.chat2db.server.domain.api.param.TableSelector;
import ai.chat2db.server.domain.api.service.TableService;
import ai.chat2db.server.tools.base.wrapper.result.ActionResult;
import ai.chat2db.server.tools.base.wrapper.result.DataResult;
import ai.chat2db.server.tools.base.wrapper.result.PageResult;
import ai.chat2db.server.tools.common.exception.ParamBusinessException;
import ai.chat2db.server.web.api.aspect.ConnectionInfoAspect;
import ai.chat2db.server.web.api.controller.ai.fastchat.embeddings.FastChatEmbeddingResponse;
import ai.chat2db.server.web.api.controller.rdb.converter.RdbWebConverter;
import ai.chat2db.server.web.api.controller.rdb.request.TableBriefQueryRequest;
import ai.chat2db.server.web.api.http.GatewayClientService;
import ai.chat2db.server.web.api.http.request.TableSchemaRequest;
import ai.chat2db.spi.model.Table;
import com.google.common.collect.Lists;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * @author moji
 */
@RestController
@ConnectionInfoAspect
@RequestMapping("/api/ai/embedding")
@Slf4j
public class EmbeddingController extends ChatController {


    @Resource
    private GatewayClientService gatewayClientService;

    @Autowired
    private RdbWebConverter rdbWebConverter;

    @Autowired
    private TableService tableService;

    /**
     * save knowledge embeddings from pdf file
     *
     * @param request
     * @return
     * @throws IOException
     */
    @PostMapping("/datasource")
    @CrossOrigin
    public ActionResult embeddings(@Valid TableBriefQueryRequest request)
        throws Exception {

        // query tables
        request.setPageSize(1000);
        TablePageQueryParam queryParam = rdbWebConverter.tablePageRequest2param(request);
        TableSelector tableSelector = new TableSelector();
        tableSelector.setColumnList(false);
        tableSelector.setIndexList(false);
        PageResult<Table> tableDTOPageResult = tableService.pageQuery(queryParam, tableSelector);

        List<Table> tables = tableDTOPageResult.getData();
        if (CollectionUtils.isEmpty(tables)) {
            return ActionResult.isSuccess();
        }

        String tableName = tables.get(0).getName();
        String tableSchema = queryTableDdl(tableName, request);

        if (StringUtils.isBlank(tableSchema)) {
            throw new ParamBusinessException("tableSchema is empty");
        }

        // save first table embedding
        TableSchemaRequest tableSchemaRequest = new TableSchemaRequest();
        tableSchemaRequest.setDataSourceId(request.getDataSourceId());
        tableSchemaRequest.setDeleteBeforeInsert(true);
        String databaseName = StringUtils.isNotBlank(request.getDatabaseName()) ? request.getDatabaseName() : request.getSchemaName();
        if (Objects.isNull(databaseName)) {
            databaseName = "";
        }
        tableSchemaRequest.setDatabaseName(databaseName);

        saveTableEmbedding(tableSchema, tableSchemaRequest);

        // save other table embedding
        tableSchemaRequest.setDeleteBeforeInsert(false);
        for (int i = 1; i < tables.size(); i++) {
            tableName = tables.get(i).getName();
            tableSchema = queryTableDdl(tableName, request);
            if (StringUtils.isBlank(tableSchema)) {
                continue;
            }
            saveTableEmbedding(tableSchema, tableSchemaRequest);
        }

        // query all the tables
        Long totalTableCount = tableDTOPageResult.getTotal();
        Integer pageSize = queryParam.getPageSize();
        if (pageSize < totalTableCount) {
            for (int i = 2; i < totalTableCount/pageSize + 1; i++) {
                queryParam.setPageNo(i);
                tableDTOPageResult = tableService.pageQuery(queryParam, tableSelector);
                tables = tableDTOPageResult.getData();
                for (Table table : tables) {
                    tableName = table.getName();
                    tableSchema = queryTableDdl(tableName, request);
                    if (StringUtils.isBlank(tableSchema)) {
                        continue;
                    }
                    saveTableEmbedding(tableSchema, tableSchemaRequest);
                }
            }
        }

        return ActionResult.isSuccess();
    }

    /**
     * save table embedding
     *
     * @param tableSchema
     * @param tableSchemaRequest
     * @throws Exception
     */
    private void saveTableEmbedding(String tableSchema, TableSchemaRequest tableSchemaRequest) throws Exception{
        List<String> schemaList = Lists.newArrayList(tableSchema);
        tableSchemaRequest.setSchemaList(schemaList);

        List<List<BigDecimal>> contentVector = new ArrayList<>();
        for(String str : schemaList){
            // request embedding
            FastChatEmbeddingResponse response = distributeAIEmbedding(str);
            if(response == null){
                continue;
            }
            contentVector.add(response.getData().get(0).getEmbedding());
        }
        tableSchemaRequest.setSchemaVector(contentVector);

        // save table embedding
        gatewayClientService.schemaVectorSave(tableSchemaRequest);
    }

    /**
     * query table schema
     *
     * @param tableName
     * @param request
     * @return
     */
    private String queryTableDdl(String tableName, TableBriefQueryRequest request) {
        ShowCreateTableParam param = new ShowCreateTableParam();
        param.setTableName(tableName);
        param.setDataSourceId(request.getDataSourceId());
        param.setDatabaseName(request.getDatabaseName());
        param.setSchemaName(request.getSchemaName());
        DataResult<String> tableSchema = tableService.showCreateTable(param);
        return tableSchema.getData();
    }

}
