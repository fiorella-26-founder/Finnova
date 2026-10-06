import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  showCancelButton?: boolean;
}

export interface ConfirmDialogState extends ConfirmDialogOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  private dialogStateSubject = new BehaviorSubject<ConfirmDialogState>({
    isOpen: false,
    message: '',
    title: '¿Confirmar acción?',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    type: 'danger',
    showCancelButton: true
  });

  public dialogState$: Observable<ConfirmDialogState> = this.dialogStateSubject.asObservable();

  /**
   * Abre un popup modal reutilizable y devuelve una Promesa que resuelve en true (confirmar) o false (cancelar).
   */
  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.dialogStateSubject.next({
        isOpen: true,
        title: options.title || '¿Estás seguro?',
        message: options.message,
        itemName: options.itemName,
        confirmText: options.confirmText || (options.type === 'danger' ? 'Eliminar' : 'Confirmar'),
        cancelText: options.cancelText || 'Cancelar',
        type: options.type || 'danger',
        showCancelButton: options.showCancelButton !== undefined ? options.showCancelButton : true,
        resolve
      });
    });
  }

  /**
   * Muestra un popup informativo/advertencia con un solo botón de acción.
   */
  alert(options: ConfirmDialogOptions | string, title?: string, type?: 'danger' | 'warning' | 'info' | 'success'): Promise<void> {
    return new Promise<void>((resolve) => {
      const opts: ConfirmDialogOptions = typeof options === 'string'
        ? { message: options, title: title || 'Aviso del Sistema', type: type || 'warning' }
        : options;

      this.dialogStateSubject.next({
        isOpen: true,
        title: opts.title || 'Aviso',
        message: opts.message,
        itemName: opts.itemName,
        confirmText: opts.confirmText || 'Entendido',
        type: opts.type || 'warning',
        showCancelButton: false,
        resolve: () => resolve()
      });
    });
  }

  onConfirm(): void {
    const current = this.dialogStateSubject.value;
    if (current.resolve) {
      current.resolve(true);
    }
    this.close();
  }

  onCancel(): void {
    const current = this.dialogStateSubject.value;
    if (current.resolve) {
      current.resolve(false);
    }
    this.close();
  }

  private close(): void {
    this.dialogStateSubject.next({
      ...this.dialogStateSubject.value,
      isOpen: false,
      resolve: undefined
    });
  }
}
