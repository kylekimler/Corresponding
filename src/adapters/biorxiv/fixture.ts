export interface BiorxivFixtureOptions {
  existingAuthors?: number;
  dialogOpen?: boolean;
  saveCloses?: boolean;
  addRemountDelayMs?: number;
  addLabelAfterSave?: string;
  /** Render a Material icon ligature inside the Add control, as bioRxiv does. */
  addIconLigature?: string;
  /** Add a hidden decoy button whose text is exactly "Add Author". */
  hiddenDecoyAddButton?: boolean;
  /** Reopen the reused dialog still holding the previous author's values. */
  staleValuesOnReopen?: boolean;
  /** Clear the reused dialog asynchronously, as a reactive framework would. */
  resetDelayMs?: number;
  /** Commit the saved author to the table asynchronously, as a server would. */
  commitDelayMs?: number;
  /** Show bioRxiv's hash error when Add is clicked before the commit lands. */
  errorOnEarlyAdd?: boolean;
}

export interface BiorxivFixtureHarness {
  savedAuthors(): Array<{
    email: string;
    firstName: string;
    middleName: string;
    lastName: string;
    affiliation: string;
    corresponding: boolean;
  }>;
  addClicks(): number;
  saveClicks(): number;
  continueClicks(): number;
}

export function mountBiorxivFixture(
  options: BiorxivFixtureOptions = {},
): BiorxivFixtureHarness {
  const iconMarkup = options.addIconLigature
    ? `<i class="v-icon material-icons">${options.addIconLigature}</i>`
    : '';
  const decoyMarkup = options.hiddenDecoyAddButton
    ? `<div class="v-dialog" style="display: none">
         <button type="button" id="decoy-add-author">Add Author</button>
       </div>`
    : '';

  document.body.innerHTML = `
    <div id="submission_form">
      <div class="v-alert error--text" id="portal-error" style="display: none"></div>
      ${decoyMarkup}
      <main class="v-content">
        <button type="button" class="v-btn theme--light primary" id="add-author">
          ${iconMarkup}Add Author
        </button>
        <table class="v-datatable v-table theme--light">
          <thead><tr><th>Author</th><th>Email</th></tr></thead>
          <tbody id="author-rows"></tbody>
        </table>
      </main>
      <div class="v-dialog__content">
        <div class="v-dialog" id="author-dialog">
          <div class="v-card">
            <div class="v-card__text">
              <label><input type="checkbox" id="consortium" /> Change to a Collaborative Group/Consortium</label>
              <label><input type="checkbox" id="corresponding" /> Mark as Corresponding Author</label>
              <div class="v-input"><label>Email</label><input type="text" id="email" /></div>
              <div class="v-input"><label>First Name</label><input type="text" name="firstName" /></div>
              <div class="v-input"><label>Middle Name(s)/Initial(s)</label><input type="text" id="middle-name" /></div>
              <div class="v-input"><label>Last Name</label><input type="text" name="lastName" /></div>
              <div class="v-input"><label>Institution</label><input type="text" name="affiliation" /></div>
            </div>
            <div class="v-card__actions">
              <button type="button" class="v-btn primary" id="save-author">Save</button>
              <button type="button" class="v-btn" id="cancel-author">Cancel</button>
            </div>
          </div>
        </div>
      </div>
      <input type="submit" name="CA_continue" value="Save and Continue" />
    </div>
  `;

  const saved: ReturnType<BiorxivFixtureHarness['savedAuthors']> = [];
  for (let index = 0; index < (options.existingAuthors ?? 0); index += 1) {
    saved.push({
      email: `existing${index + 1}@example.org`,
      firstName: `Existing${index + 1}`,
      middleName: '',
      lastName: 'Author',
      affiliation: 'Existing Institute',
      corresponding: index === 0,
    });
  }

  const dialog = document.getElementById('author-dialog')!;
  const rows = document.getElementById('author-rows')!;
  const add = document.getElementById('add-author') as HTMLButtonElement;
  const save = document.getElementById('save-author') as HTMLButtonElement;
  const continueControl = document.querySelector(
    'input[name="CA_continue"]',
  ) as HTMLInputElement;
  let addClicks = 0;
  let saveClicks = 0;
  let continueClicks = 0;
  let commitPending = false;

  function renderRows() {
    rows.innerHTML =
      saved.length === 0
        ? '<tr><td colspan="2">No authors added</td></tr>'
        : saved
            .map(
              (author) =>
                `<tr><td>${author.firstName} ${author.lastName}</td><td>${author.email}</td></tr>`,
            )
            .join('');
  }

  function setDialogOpen(open: boolean) {
    dialog.classList.toggle('v-dialog--active', open);
    dialog.style.display = open ? 'block' : 'none';
  }

  function resetDialog() {
    dialog.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      if (input.type === 'checkbox') input.checked = false;
      else input.value = '';
    });
  }

  add.addEventListener('click', () => {
    addClicks += 1;
    if (options.errorOnEarlyAdd && commitPending) {
      const banner = document.getElementById('portal-error')!;
      banner.textContent = 'Author does not exists hash do not match';
      banner.style.display = 'block';
      return;
    }
    if (options.staleValuesOnReopen) {
      // Reused dialog keeps the previous author's values.
      setDialogOpen(true);
      return;
    }
    if (options.resetDelayMs !== undefined) {
      setDialogOpen(true);
      setTimeout(resetDialog, options.resetDelayMs);
      return;
    }
    resetDialog();
    setDialogOpen(true);
  });
  save.addEventListener('click', () => {
    saveClicks += 1;
    const record = {
      email: (document.getElementById('email') as HTMLInputElement).value,
      firstName: (
        document.querySelector('input[name="firstName"]') as HTMLInputElement
      ).value,
      middleName: (
        document.getElementById('middle-name') as HTMLInputElement
      ).value,
      lastName: (
        document.querySelector('input[name="lastName"]') as HTMLInputElement
      ).value,
      affiliation: (
        document.querySelector('input[name="affiliation"]') as HTMLInputElement
      ).value,
      corresponding: (
        document.getElementById('corresponding') as HTMLInputElement
      ).checked,
    };
    if (options.saveCloses !== false) setDialogOpen(false);
    if (options.addRemountDelayMs !== undefined) {
      add.style.display = 'none';
      setTimeout(() => {
        add.innerHTML = `${iconMarkup}${options.addLabelAfterSave ?? 'Add Author'}`;
        add.style.display = '';
      }, options.addRemountDelayMs);
    }

    const commit = () => {
      saved.push(record);
      commitPending = false;
      renderRows();
    };
    if (options.commitDelayMs !== undefined) {
      commitPending = true;
      setTimeout(commit, options.commitDelayMs);
    } else {
      commit();
    }
  });
  continueControl.addEventListener('click', (event) => {
    event.preventDefault();
    continueClicks += 1;
  });

  renderRows();
  setDialogOpen(options.dialogOpen === true);

  return {
    savedAuthors: () => saved.map((author) => ({ ...author })),
    addClicks: () => addClicks,
    saveClicks: () => saveClicks,
    continueClicks: () => continueClicks,
  };
}
