/**
 * Users component (admin only)
 */
const Users = (() => {
  async function render() {
    try {
      const users = await API.get('/auth/users');
      const rows = users.map(u => `<tr>
        <td class="mono">${u.id}</td>
        <td>${escapeHTML(u.username)}</td>
        <td class="mono">${escapeHTML(u.email)}</td>
        <td><span class="tag">${escapeHTML(u.role)}</span></td>
        <td>${escapeHTML(u.full_name || '')}</td>
        <td><span class="dot ${u.is_active ? 'green' : 'red'}"></span></td>
        <td>
          <button class="btn ghost small" onclick="Users.toggleActive(${u.id}, ${u.is_active ? 0 : 1})">${u.is_active ? 'Deaktiv' : 'Aktiv'}</button>
        </td>
      </tr>`).join('');
      $('tblUsers').innerHTML = rows || '<tr><td colspan="7" class="muted">İstifadəçi yoxdur</td></tr>';
    } catch (err) {
      console.error('Users render:', err);
    }
  }

  async function save() {
    const data = {
      username: $('uUsername').value.trim(),
      email: $('uEmail').value.trim(),
      password: $('uPassword').value,
      role: $('uRole').value,
      full_name: $('uFullName').value.trim(),
      phone: $('uPhone').value.trim(),
    };
    if (!data.username || !data.email || !data.password) {
      return showError('İstifadəçi adı, email və şifrə tələb olunur');
    }
    try {
      await API.post('/auth/register', data);
      ['uUsername', 'uEmail', 'uPassword', 'uFullName', 'uPhone'].forEach(id => $(id).value = '');
      await render();
    } catch (err) { showError(err.message); }
  }

  async function toggleActive(id, newState) {
    try {
      await API.patch(`/auth/users/${id}`, { is_active: newState });
      await render();
    } catch (err) { showError(err.message); }
  }

  return { render, save, toggleActive };
})();
