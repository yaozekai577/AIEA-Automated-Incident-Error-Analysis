package com.yzk.aiea.repository;

import com.yzk.aiea.entity.JiraTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JiraTicketRepository extends JpaRepository<JiraTicket, Long> {

    Optional<JiraTicket> findByJiraKey(String jiraKey);

    List<JiraTicket> findByEventId(Long eventId);
}
