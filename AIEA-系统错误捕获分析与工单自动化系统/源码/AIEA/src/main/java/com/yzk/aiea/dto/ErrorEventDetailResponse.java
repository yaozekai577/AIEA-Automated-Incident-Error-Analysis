package com.yzk.aiea.dto;

import java.util.List;

import com.yzk.aiea.entity.AnalysisResult;
import com.yzk.aiea.entity.ErrorEvent;
import com.yzk.aiea.entity.JiraTicket;
import com.yzk.aiea.entity.NotifyRecord;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ErrorEventDetailResponse {
    private ErrorEvent event;
    private AnalysisResult analysis;
    private List<NotifyRecord> notifies;
    private List<JiraTicket> tickets;
}
