package com.yzk.aiea.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.yzk.aiea.entity.InternalTicket;

@Repository
public interface InternalTicketRepository extends JpaRepository<InternalTicket, Long> {

    /** 根据事件 ID 查找工单 */
    List<InternalTicket> findByEventId(Long eventId);

    /** 根据指纹查找工单（同指纹复用） */
    List<InternalTicket> findByFingerprint(String fingerprint);

    /** 根据状态查询 */
    List<InternalTicket> findByStatus(String status);

    /** 根据处理人查询 */
    List<InternalTicket> findByAssignee(String assignee);

    /** 根据指纹查找未关闭的工单 */
    Optional<InternalTicket> findFirstByFingerprintAndStatusNotIn(String fingerprint, List<String> excludeStatuses);
}
