/* ========== 1. Theme ========== */

function getPreferredTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) return saved;
  return 'dark';
}

function applyTheme(theme) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
    if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    }
  }
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

// Initialize theme on load
(function() {
  const theme = getPreferredTheme();
  applyTheme(theme);
})();

/* ========== 2. Toast ========== */

function getToastContainer() {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 2000;

  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;

  var icon = '';
  if (type === 'success') icon = '\u2705 ';
  else if (type === 'error') icon = '\u274C ';
  else icon = '\u2139\uFE0F ';

  toast.textContent = icon + message;
  container.appendChild(toast);

  setTimeout(function() {
    toast.classList.add('hiding');
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

/* ========== 3. Modal ========== */

function showModal(title, message, onConfirm, onCancel) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  var card = document.createElement('div');
  card.className = 'modal-card';

  var titleEl = document.createElement('h3');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;

  var msgEl = document.createElement('p');
  msgEl.className = 'modal-message';
  msgEl.textContent = message;

  var actions = document.createElement('div');
  actions.className = 'modal-actions';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = '\u53D6\u6D88';
  cancelBtn.onclick = function() {
    closeModal();
    if (onCancel) onCancel();
  };

  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = '\u786E\u8BA4';
  confirmBtn.onclick = function() {
    closeModal();
    if (onConfirm) onConfirm();
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  card.appendChild(titleEl);
  card.appendChild(msgEl);
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeModal();
      if (onCancel) onCancel();
    }
  });

  // Close on Esc
  function escHandler(e) {
    if (e.key === 'Escape') {
      closeModal();
      if (onCancel) onCancel();
      document.removeEventListener('keydown', escHandler);
    }
  }
  document.addEventListener('keydown', escHandler);

  function closeModal() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', escHandler);
  }

  return { close: closeModal };
}

/* ========== 4. Dropdown / Context Menu ========== */

var activeDropdown = null;

function closeActiveDropdown() {
  if (activeDropdown && activeDropdown.parentNode) {
    activeDropdown.parentNode.removeChild(activeDropdown);
  }
  activeDropdown = null;
}

function showDropdown(triggerEl, items) {
  closeActiveDropdown();

  var menu = document.createElement('div');
  menu.className = 'dropdown-menu';

  items.forEach(function(item) {
    if (item.divider) {
      var div = document.createElement('div');
      div.className = 'dropdown-divider';
      menu.appendChild(div);
      return;
    }
    var el = document.createElement('div');
    el.className = 'dropdown-item' + (item.danger ? ' danger' : '');
    el.innerHTML = (item.icon ? '<span>' + item.icon + '</span>' : '') + '<span>' + item.label + '</span>';
    el.onclick = function() {
      closeActiveDropdown();
      if (item.action) item.action();
    };
    menu.appendChild(el);
  });

  document.body.appendChild(menu);
  activeDropdown = menu;

  // Position near trigger
  var rect = triggerEl.getBoundingClientRect();
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.left = rect.left + 'px';

  // Ensure menu stays in viewport
  requestAnimationFrame(function() {
    var menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - menuRect.width - 8) + 'px';
    }
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = (rect.top - menuRect.height - 4) + 'px';
    }
  });

  // Close on outside click
  setTimeout(function() {
    document.addEventListener('click', onOutsideClick);
  }, 0);

  function onOutsideClick(e) {
    if (!menu.contains(e.target) && e.target !== triggerEl) {
      closeActiveDropdown();
      document.removeEventListener('click', onOutsideClick);
    }
  }
}

function buildMenuItems(menu, items) {
  items.forEach(function(item) {
    if (item.divider) {
      var div = document.createElement('div');
      div.className = 'dropdown-divider';
      menu.appendChild(div);
      return;
    }
    var el = document.createElement('div');
    el.className = 'dropdown-item' + (item.danger ? ' danger' : '') + (item.children ? ' has-submenu' : '');
    el.innerHTML = (item.icon ? '<span>' + item.icon + '</span>' : '') +
      '<span>' + item.label + '</span>' +
      (item.children ? '<span class="submenu-arrow">▶</span>' : '');

    if (item.children) {
      var sub = document.createElement('div');
      sub.className = 'dropdown-submenu';
      item.children.forEach(function(child) {
        if (child.divider) {
          var d = document.createElement('div');
          d.className = 'dropdown-divider';
          sub.appendChild(d);
          return;
        }
        var childEl = document.createElement('div');
        childEl.className = 'dropdown-item' + (child.danger ? ' danger' : '');
        childEl.innerHTML = (child.icon ? '<span>' + child.icon + '</span>' : '') + '<span>' + child.label + '</span>';
        childEl.onclick = function(e) {
          e.stopPropagation();
          closeActiveDropdown();
          if (child.action) child.action();
        };
        sub.appendChild(childEl);
      });
      el.appendChild(sub);
    } else {
      el.onclick = function() {
        closeActiveDropdown();
        if (item.action) item.action();
      };
    }
    menu.appendChild(el);
  });
}

function showContextMenu(event, items) {
  event.preventDefault();
  closeActiveDropdown();

  var menu = document.createElement('div');
  menu.className = 'dropdown-menu';

  buildMenuItems(menu, items);

  document.body.appendChild(menu);
  activeDropdown = menu;

  menu.style.top = event.clientY + 'px';
  menu.style.left = event.clientX + 'px';

  // Ensure in viewport
  requestAnimationFrame(function() {
    var menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      menu.style.left = (event.clientX - menuRect.width) + 'px';
    }
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = (event.clientY - menuRect.height) + 'px';
    }
  });

  setTimeout(function() {
    document.addEventListener('click', onOutsideClick);
  }, 0);

  function onOutsideClick() {
    closeActiveDropdown();
    document.removeEventListener('click', onOutsideClick);
  }
}

/* ========== 5. Sidebar ========== */

function toggleSidebar() {
  var sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

function closeMobileSidebar() {
  var sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');
}

// Sidebar tab switching (会话 / 任务)
function switchSidebarTab(tab) {
  document.querySelectorAll('.sidebar-tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.sidebar-tab-pane').forEach(function(p) {
    p.classList.toggle('active', p.id === 'sidebar-' + tab);
  });
  var chatActions = document.getElementById('chatActions');
  var taskActions = document.getElementById('taskActions');
  if (chatActions) chatActions.style.display = tab === 'chats' ? '' : 'none';
  if (taskActions) taskActions.style.display = tab === 'tasks' ? '' : 'none';
  var searchInput = document.querySelector('.sidebar-search input');
  if (searchInput) searchInput.placeholder = tab === 'chats' ? '搜索会话...' : '搜索任务...';
}

// Initialize sidebar section collapse/expand
function initSidebarSections() {
  var headers = document.querySelectorAll('.sidebar-section-header');
  headers.forEach(function(header) {
    header.addEventListener('click', function() {
      var section = header.closest('.sidebar-section');
      if (section) section.classList.toggle('collapsed');
    });
  });
}

// Initialize sidebar search filtering
function initSidebarSearch() {
  var searchInput = document.querySelector('.sidebar-search input');
  if (!searchInput) return;

  searchInput.addEventListener('input', function() {
    var query = this.value.toLowerCase().trim();
    var items = document.querySelectorAll('.sidebar-section-items .sidebar-item');
    items.forEach(function(item) {
      var text = item.textContent.toLowerCase();
      item.style.display = text.includes(query) || query === '' ? '' : 'none';
    });
  });
}

/* -- Pin / Unpin / Archive / Move -- */

function pinItem(item) {
  var section = document.querySelector('#section-pinned .sidebar-section-items');
  if (!section) return;
  item.setAttribute('data-pinned', 'true');
  section.appendChild(item);
  showToast('已置顶: ' + (item.querySelector('.item-text') ? item.querySelector('.item-text').textContent : ''), 'success');
}

function unpinItem(item) {
  var section = document.querySelector('#section-recent .sidebar-section-items');
  if (!section) return;
  item.removeAttribute('data-pinned');
  section.prepend(item);
  showToast('已取消置顶: ' + (item.querySelector('.item-text') ? item.querySelector('.item-text').textContent : ''), 'success');
}

function archiveItem(item) {
  var section = document.querySelector('#section-archive .sidebar-section-items');
  if (!section) return;
  item.setAttribute('data-archived', 'true');
  item.removeAttribute('data-pinned');
  item.removeAttribute('data-folder');
  section.appendChild(item);
  document.getElementById('section-archive').classList.remove('collapsed');
  showToast('已归档: ' + (item.querySelector('.item-text') ? item.querySelector('.item-text').textContent : ''), 'success');
}

function unarchiveItem(item) {
  var section = document.querySelector('#section-recent .sidebar-section-items');
  if (!section) return;
  item.removeAttribute('data-archived');
  section.prepend(item);
  showToast('已取消归档', 'success');
}

function moveToFolder(item, folderName, sectionEl) {
  // If sectionEl is provided directly, use it; otherwise try to find by known IDs
  if (!sectionEl) {
    if (folderName === '工作') sectionEl = document.getElementById('section-work');
    else if (folderName === '学习') sectionEl = document.getElementById('section-learn');
  }
  if (!sectionEl) return;
  var items = sectionEl.querySelector('.sidebar-section-items');
  if (!items) return;
  item.removeAttribute('data-pinned');
  item.removeAttribute('data-archived');
  item.setAttribute('data-folder', folderName);
  items.appendChild(item);
  showToast('已移动到 "' + folderName + '" 文件夹', 'success');
}

function getFolderMenuItems(item) {
  var children = [];
  // Built-in folders
  var builtinFolders = [
    { id: 'section-work', name: '工作' },
    { id: 'section-learn', name: '学习' }
  ];
  builtinFolders.forEach(function(f) {
    var el = document.getElementById(f.id);
    if (el) {
      children.push({ icon: '📁', label: f.name, action: function() { moveToFolder(item, f.name, el); } });
    }
  });
  // Dynamically created folders
  var customSections = document.querySelectorAll('.sidebar-section[data-folder-name]');
  customSections.forEach(function(sec) {
    var name = sec.getAttribute('data-folder-name');
    children.push({ icon: '📁', label: name, action: function() { moveToFolder(item, name, sec); } });
  });
  return children;
}

function deleteItem(item) {
  var sessionName = item.querySelector('.item-text') ? item.querySelector('.item-text').textContent : '';
  showModal('删除会话', '确定删除 "' + sessionName + '" 吗？此操作不可撤回。', function() {
    item.style.transition = 'opacity 0.2s, max-height 0.2s';
    item.style.opacity = '0';
    item.style.maxHeight = '0';
    item.style.overflow = 'hidden';
    setTimeout(function() { item.remove(); }, 200);
    showToast('已删除', 'success');
  });
}

/* -- Create Sidebar Folder -- */

var folderCounter = 0;

function createSidebarFolder() {
  var addBtn = document.querySelector('.add-folder-btn');
  if (!addBtn) return;

  folderCounter++;
  var sectionId = 'section-custom-' + folderCounter;

  // Create new section
  var section = document.createElement('div');
  section.className = 'sidebar-section';
  section.id = sectionId;

  var header = document.createElement('div');
  header.className = 'sidebar-section-header';

  var nameSpan = document.createElement('span');
  nameSpan.innerHTML = '📁 ';

  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-name-input';
  input.placeholder = '文件夹名称';
  input.value = '';

  nameSpan.appendChild(input);

  var chevron = document.createElement('span');
  chevron.className = 'chevron';
  chevron.textContent = '▼';

  header.appendChild(nameSpan);
  header.appendChild(chevron);

  var itemsDiv = document.createElement('div');
  itemsDiv.className = 'sidebar-section-items';

  section.appendChild(header);
  section.appendChild(itemsDiv);

  // Insert before the add-folder button
  addBtn.parentNode.insertBefore(section, addBtn);

  // Focus the input
  input.focus();

  function finishCreate() {
    var name = input.value.trim();
    if (!name) {
      // Empty name → remove the section
      section.remove();
      return;
    }
    // Replace input with static text
    nameSpan.textContent = '📁 ' + name;
    section.setAttribute('data-folder-name', name);

    // Bind collapse/expand
    header.addEventListener('click', function() {
      section.classList.toggle('collapsed');
    });

    // Bind right-click context menu for the new folder
    header.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e, [
        { icon: '✏️', label: '重命名文件夹', action: function() { renameSidebarFolder(section); } },
        { divider: true },
        { icon: '🗑️', label: '删除文件夹', danger: true, action: function() { deleteSidebarFolder(section); } }
      ]);
    });

    showToast('已创建文件夹 "' + name + '"', 'success');
  }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishCreate();
    }
    if (e.key === 'Escape') {
      section.remove();
    }
  });

  input.addEventListener('blur', function() {
    // Small delay to allow Enter key to fire first
    setTimeout(function() {
      if (input.parentNode) finishCreate();
    }, 100);
  });
}

/* -- Delete / Rename Sidebar Folder -- */

function isFolderSection(section) {
  if (!section) return false;
  var id = section.id || '';
  return id === 'section-work' || id === 'section-learn' || section.hasAttribute('data-folder-name');
}

function getFolderDisplayName(section) {
  if (section.hasAttribute('data-folder-name')) return section.getAttribute('data-folder-name');
  if (section.id === 'section-work') return '工作';
  if (section.id === 'section-learn') return '学习';
  var headerSpan = section.querySelector('.sidebar-section-header > span:first-child');
  if (headerSpan) {
    var text = headerSpan.textContent.replace(/^📁\s*/, '');
    return text || '未命名';
  }
  return '未命名';
}

function deleteSidebarFolder(section) {
  var name = getFolderDisplayName(section);
  var items = section.querySelectorAll('.sidebar-item');
  var count = items.length;

  // Build custom modal
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  var card = document.createElement('div');
  card.className = 'modal-card';

  var titleEl = document.createElement('h3');
  titleEl.className = 'modal-title';
  titleEl.textContent = '删除文件夹';

  var msgEl = document.createElement('div');
  msgEl.className = 'modal-message';
  if (count > 0) {
    msgEl.innerHTML = '文件夹 "<strong>' + name + '</strong>" 包含 <strong>' + count + '</strong> 个会话/任务。<br>是否同步删除文件夹下的所有内容？';
  } else {
    msgEl.innerHTML = '确定删除文件夹 "<strong>' + name + '</strong>" 吗？';
  }

  var actions = document.createElement('div');
  actions.className = 'modal-actions folder-delete-actions';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = '取消';
  cancelBtn.onclick = function() { close(); };

  actions.appendChild(cancelBtn);

  if (count > 0) {
    var keepBtn = document.createElement('button');
    keepBtn.className = 'btn btn-primary';
    keepBtn.textContent = '仅删除文件夹';
    keepBtn.onclick = function() {
      close();
      // Move all items to "最近" section
      var recentSection = document.querySelector('#section-recent .sidebar-section-items');
      if (recentSection) {
        var childItems = section.querySelectorAll('.sidebar-item');
        childItems.forEach(function(item) {
          item.removeAttribute('data-folder');
          recentSection.appendChild(item);
        });
      }
      removeSection(section);
      showToast('已删除文件夹 "' + name + '"，内容已移至"最近"', 'success');
    };

    var deleteAllBtn = document.createElement('button');
    deleteAllBtn.className = 'btn btn-danger';
    deleteAllBtn.textContent = '全部删除';
    deleteAllBtn.onclick = function() {
      close();
      removeSection(section);
      showToast('已删除文件夹 "' + name + '" 及其所有内容', 'success');
    };

    actions.appendChild(keepBtn);
    actions.appendChild(deleteAllBtn);
  } else {
    var confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.textContent = '删除';
    confirmBtn.onclick = function() {
      close();
      removeSection(section);
      showToast('已删除文件夹 "' + name + '"', 'success');
    };
    actions.appendChild(confirmBtn);
  }

  card.appendChild(titleEl);
  card.appendChild(msgEl);
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) close();
  });

  function escHandler(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', escHandler);

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', escHandler);
  }

  function removeSection(sec) {
    sec.style.transition = 'opacity 0.2s, max-height 0.3s';
    sec.style.opacity = '0';
    sec.style.maxHeight = '0';
    sec.style.overflow = 'hidden';
    setTimeout(function() { sec.remove(); }, 300);
  }
}

function renameSidebarFolder(section) {
  var headerSpan = section.querySelector('.sidebar-section-header > span:first-child');
  if (!headerSpan) return;
  var oldName = getFolderDisplayName(section);

  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-name-input';
  input.value = oldName;

  var originalHTML = headerSpan.innerHTML;
  headerSpan.innerHTML = '📁 ';
  headerSpan.appendChild(input);
  input.focus();
  input.select();

  function finish() {
    var newName = input.value.trim() || oldName;
    headerSpan.textContent = '📁 ' + newName;
    if (section.hasAttribute('data-folder-name')) {
      section.setAttribute('data-folder-name', newName);
    }
    if (newName !== oldName) {
      showToast('已重命名为 "' + newName + '"', 'success');
    }
  }

  input.addEventListener('keydown', function(e) {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') { input.value = oldName; finish(); }
  });
  input.addEventListener('click', function(e) { e.stopPropagation(); });
  input.addEventListener('blur', finish);
}

// Initialize context menu on folder section headers
function initFolderContextMenu() {
  var sections = document.querySelectorAll('.sidebar-section');
  sections.forEach(function(section) {
    if (!isFolderSection(section)) return;
    var header = section.querySelector('.sidebar-section-header');
    if (!header) return;

    header.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();

      var menuItems = [
        { icon: '✏️', label: '重命名文件夹', action: function() { renameSidebarFolder(section); } },
        { divider: true },
        { icon: '🗑️', label: '删除文件夹', danger: true, action: function() { deleteSidebarFolder(section); } }
      ];

      showContextMenu(e, menuItems);
    });
  });
}

// Full context menu for sidebar items (all pages)
function initSidebarContextMenu() {
  var items = document.querySelectorAll('.sidebar-item[data-session]');
  items.forEach(function(item) {
    item.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var isPinned = item.hasAttribute('data-pinned');
      var isArchived = item.hasAttribute('data-archived');
      var isInTaskTab = !!item.closest('#sidebar-tasks');
      var menuItems = [];

      // Pin / Unpin
      if (isPinned) {
        menuItems.push({ icon: '📌', label: '取消置顶', action: function() { unpinItem(item); } });
      } else {
        menuItems.push({ icon: '📌', label: '置顶', action: function() { pinItem(item); } });
      }

      menuItems.push({ icon: '✏️', label: '重命名', action: function() { startRename(item); } });

      // Move to folder & Archive — only for chats, not tasks
      if (!isInTaskTab) {
        var folderChildren = getFolderMenuItems(item);
        if (folderChildren.length > 0) {
          menuItems.push({ icon: '📁', label: '移动到文件夹', children: folderChildren });
        }

        if (isArchived) {
          menuItems.push({ icon: '📤', label: '取消归档', action: function() { unarchiveItem(item); } });
        } else {
          menuItems.push({ icon: '🗄️', label: '归档', action: function() { archiveItem(item); } });
        }
      }

      menuItems.push({ divider: true });
      menuItems.push({ icon: '🗑️', label: '删除', danger: true, action: function() { deleteItem(item); } });

      showContextMenu(e, menuItems);
    });
  });
}

// Rename functionality
function startRename(item) {
  var textEl = item.querySelector('.item-text');
  if (!textEl) return;
  var oldName = textEl.textContent;

  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename-input';
  input.value = oldName;

  textEl.style.display = 'none';
  item.insertBefore(input, textEl.nextSibling);
  input.focus();
  input.select();

  function finishRename() {
    var newName = input.value.trim() || oldName;
    textEl.textContent = newName;
    textEl.style.display = '';
    if (input.parentNode) input.parentNode.removeChild(input);
    if (newName !== oldName) {
      showToast('\u5DF2\u91CD\u547D\u540D\u4E3A "' + newName + '"', 'success');
    }
  }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') finishRename();
    if (e.key === 'Escape') {
      input.value = oldName;
      finishRename();
    }
  });
  input.addEventListener('blur', finishRename);
}

// Sidebar item hover action buttons (only rename + delete)
function initSidebarItemActions() {
  document.querySelectorAll('.sidebar-item .item-action-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var item = btn.closest('.sidebar-item');
      var sessionName = item.querySelector('.item-text') ? item.querySelector('.item-text').textContent : '';
      var action = btn.dataset.action;

      if (action === 'rename') {
        startRename(item);
      } else if (action === 'delete') {
        showModal('\u5220\u9664\u4F1A\u8BDD', '\u786E\u5B9A\u5220\u9664 "' + sessionName + '" \u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u56DE\u3002', function() {
          item.style.transition = 'opacity 0.2s, max-height 0.2s';
          item.style.opacity = '0';
          item.style.maxHeight = '0';
          item.style.overflow = 'hidden';
          setTimeout(function() { item.remove(); }, 200);
          showToast('\u5DF2\u5220\u9664', 'success');
        });
      }
    });
  });
}

/* ========== 6. TypeWriter ========== */

function typeWriter(element, text, speed, onComplete) {
  speed = speed || 30;
  var index = 0;
  var cancelled = false;

  function type() {
    if (cancelled) return;
    if (index < text.length) {
      element.innerHTML = text.substring(0, index + 1);
      index++;
      setTimeout(type, speed);
    } else {
      if (onComplete) onComplete();
    }
  }

  type();

  return function cancel() {
    cancelled = true;
    element.innerHTML = text;
    if (onComplete) onComplete();
  };
}

/* ========== 7. Auto-resize Textarea ========== */

function autoResize(textarea) {
  if (!textarea) return;

  function resize() {
    textarea.style.height = 'auto';
    var maxHeight = parseInt(getComputedStyle(textarea).maxHeight) || 120;
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
  }

  textarea.addEventListener('input', resize);
  resize();
}

/* ========== 8. Tab Bar ========== */

function initTabBar() {
  var tabBars = document.querySelectorAll('.tab-bar');
  tabBars.forEach(function(bar) {
    var btns = bar.querySelectorAll('.tab-btn');
    var indicator = bar.querySelector('.tab-indicator');

    function activateTab(btn) {
      btns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      // Move indicator
      if (indicator) {
        indicator.style.left = btn.offsetLeft + 'px';
        indicator.style.width = btn.offsetWidth + 'px';
      }

      // Show corresponding content
      var tabId = btn.dataset.tab;
      if (tabId) {
        var container = bar.closest('.tab-container') || bar.parentElement;
        var contents = container.querySelectorAll('.tab-content');
        contents.forEach(function(c) { c.classList.remove('active'); });
        var target = container.querySelector('#' + tabId);
        if (target) target.classList.add('active');
      }
    }

    btns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        activateTab(btn);
      });
    });

    // Initialize active tab indicator position
    var active = bar.querySelector('.tab-btn.active');
    if (active && indicator) {
      indicator.style.left = active.offsetLeft + 'px';
      indicator.style.width = active.offsetWidth + 'px';
    }
  });
}

/* ========== 9. Panel Resize ========== */

function initPanelResize() {
  var handle = document.querySelector('.panel-resize-handle');
  var panel = document.querySelector('.right-panel');
  if (!handle || !panel) return;

  var startX, startWidth;

  handle.addEventListener('mousedown', function(e) {
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    handle.classList.add('dragging');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  });

  function onMouseMove(e) {
    var diff = startX - e.clientX;
    var newWidth = Math.max(280, Math.min(startWidth + diff, window.innerWidth * 0.6));
    panel.style.width = newWidth + 'px';
    panel.style.minWidth = newWidth + 'px';
  }

  function onMouseUp() {
    handle.classList.remove('dragging');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

/* ========== 10. Page Loading Bar ========== */

function createLoadingBar() {
  var bar = document.createElement('div');
  bar.className = 'page-loading-bar';
  document.body.appendChild(bar);
  return bar;
}

function showPageLoading() {
  var bar = document.querySelector('.page-loading-bar') || createLoadingBar();
  bar.style.transition = 'none';
  bar.style.width = '0';
  bar.style.opacity = '1';
  // Force reflow
  bar.offsetWidth;
  bar.style.transition = 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
  bar.style.width = '85%';
}

function finishPageLoading() {
  var bar = document.querySelector('.page-loading-bar');
  if (!bar) return;
  bar.style.transition = 'width 0.2s ease, opacity 0.3s ease 0.2s';
  bar.style.width = '100%';
  bar.style.opacity = '0';
}

// Intercept <a> clicks to show loading bar
function initLoadingBarInterception() {
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (link && link.href && !link.href.startsWith('javascript') && !link.href.startsWith('#')) {
      showPageLoading();
    }
  });

  // Intercept location.href assignments: provide a helper
  var origLocationAssign = window.location.assign;
  window.navigateTo = function(url) {
    showPageLoading();
    setTimeout(function() { window.location.href = url; }, 50);
  };
}

/* ========== 11. Sidebar Task Empty State ========== */

function initTaskEmptyState() {
  var taskPane = document.getElementById('sidebar-tasks');
  if (!taskPane) return;

  // Check if empty state element already exists
  var emptyState = taskPane.querySelector('.sidebar-empty-state');
  if (!emptyState) {
    emptyState = document.createElement('div');
    emptyState.className = 'sidebar-empty-state';
    emptyState.innerHTML =
      '<div class="empty-icon">📋</div>' +
      '<div class="empty-text">暂无定期任务</div>' +
      '<span class="empty-action" onclick="location.href=\'task-config.html\'">+ 创建第一个任务</span>';
    taskPane.appendChild(emptyState);
  }

  checkTaskEmptyState();
}

function checkTaskEmptyState() {
  var taskPane = document.getElementById('sidebar-tasks');
  if (!taskPane) return;
  var emptyState = taskPane.querySelector('.sidebar-empty-state');
  if (!emptyState) return;

  var items = taskPane.querySelectorAll('.sidebar-item');
  var hasVisible = false;
  items.forEach(function(item) {
    if (item.offsetParent !== null && item.style.display !== 'none') {
      hasVisible = true;
    }
  });

  if (hasVisible) {
    emptyState.classList.remove('visible');
  } else {
    emptyState.classList.add('visible');
  }
}

/* ========== 12. DOMContentLoaded Init ========== */

document.addEventListener('DOMContentLoaded', function() {
  // Page load complete animation
  var bar = createLoadingBar();
  bar.style.transition = 'none';
  bar.style.width = '70%';
  bar.style.opacity = '1';
  bar.offsetWidth;
  finishPageLoading();

  // Intercept future navigations
  initLoadingBarInterception();

  // Init sidebar
  initSidebarSections();
  initSidebarSearch();
  initSidebarContextMenu();
  initSidebarItemActions();
  initFolderContextMenu();

  // Init task empty state
  initTaskEmptyState();

  // Init tab bars
  initTabBar();

  // Init panel resize
  initPanelResize();

  // Init auto-resize textareas
  document.querySelectorAll('.chat-textarea, textarea[data-auto-resize]').forEach(function(ta) {
    autoResize(ta);
  });

  // Sidebar overlay click (mobile)
  var overlay = document.querySelector('.sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', closeMobileSidebar);
  }

  // Close dropdown on Esc
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeActiveDropdown();
    }
  });
});
