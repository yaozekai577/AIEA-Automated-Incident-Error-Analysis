package com.yzk.aiea.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.yzk.aiea.entity.TicketLog;

@Repository
public interface TicketLogRepository extends JpaRepository<TicketLog, Long> {

    List<TicketLog> findByTicketIdOrderByCreatedAtAsc(Long ticketId);
}
