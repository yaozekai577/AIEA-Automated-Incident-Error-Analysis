package com.yzk.aiea.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yzk.aiea.dto.ErrorEventDetailResponse;
import com.yzk.aiea.entity.AnalysisResult;
import com.yzk.aiea.entity.ErrorEvent;
import com.yzk.aiea.entity.JiraTicket;
import com.yzk.aiea.entity.NotifyRecord;
import com.yzk.aiea.repository.AnalysisResultRepository;
import com.yzk.aiea.repository.ErrorEventRepository;
import com.yzk.aiea.repository.JiraTicketRepository;
import com.yzk.aiea.repository.NotifyRecordRepository;
import com.yzk.aiea.service.pipeline.ErrorPipelineService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/v1/errors")
@Tag(name = "错误详情与重试", description = "事件详情查询与失败重放")
public class EventQueryController {

    private final ErrorEventRepository errorEventRepository;
    private final AnalysisResultRepository analysisResultRepository;
    private final NotifyRecordRepository notifyRecordRepository;
    private final JiraTicketRepository jiraTicketRepository;
    private final ErrorPipelineService errorPipelineService;

    public EventQueryController(ErrorEventRepository errorEventRepository,
                                AnalysisResultRepository analysisResultRepository,
                                NotifyRecordRepository notifyRecordRepository,
                                JiraTicketRepository jiraTicketRepository,
                                ErrorPipelineService errorPipelineService) {
        this.errorEventRepository = errorEventRepository;
        this.analysisResultRepository = analysisResultRepository;
        this.notifyRecordRepository = notifyRecordRepository;
        this.jiraTicketRepository = jiraTicketRepository;
        this.errorPipelineService = errorPipelineService;
    }

    @GetMapping("/{id}")
    @Operation(summary = "错误事件详情", description = "含分析结果、通知记录、Jira 关联")
    public ResponseEntity<?> detail(@PathVariable Long id) {
        return errorEventRepository.findById(id)
                .<ResponseEntity<?>>map(event -> {
                    AnalysisResult analysis = analysisResultRepository.findByEventId(id).orElse(null);
                    List<NotifyRecord> notifies = notifyRecordRepository.findByEventId(id);
                    List<JiraTicket> tickets = jiraTicketRepository.findByEventId(id);
                    return ResponseEntity.ok(new ErrorEventDetailResponse(event, analysis, notifies, tickets));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "event not found")));
    }

    @PostMapping("/{id}/retry")
    @Operation(summary = "重试流水线", description = "对 FAILED 或卡住的事件重新触发分析/建单/通知")
    public ResponseEntity<?> retry(@PathVariable Long id) {
        ErrorEvent event = errorEventRepository.findById(id).orElse(null);
        if (event == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "event not found"));
        }
        // 删除旧分析结果，允许重新分析
        analysisResultRepository.findByEventId(id).ifPresent(analysisResultRepository::delete);
        event.setStatus("RECEIVED");
        errorEventRepository.save(event);
        errorPipelineService.processAsync(id);
        return ResponseEntity.ok(Map.of(
                "id", id,
                "message", "已重新入队异步流水线"
        ));
    }
}
